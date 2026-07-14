import axios from 'axios';

/**
 * Resolves freely-licensed car photos from Wikipedia/Wikimedia Commons.
 * Strategy per model: take the lead image of the model's Wikipedia page plus
 * every JPEG referenced by the article, filter out logos/maps/tiny images and
 * request at most 1600px-wide renditions so downstream processing stays fast.
 */

const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia's UA policy requires an identifiable client string.
const USER_AGENT = 'AutoFlowDemoSeed/1.0 (local dev fixture; https://autoflow.example)';
const HTTP_TIMEOUT_MS = 20_000;
const MAX_SOURCE_WIDTH = 1600;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 500;
// Diagrams, logos, badges and maps are common on car articles — not photos.
const EXCLUDED_TITLE = /logo|badge|emblem|map|diagram|chart|graph|drawing|sales|evolution/i;

const http = axios.create({
  timeout: HTTP_TIMEOUT_MS,
  headers: { 'User-Agent': USER_AGENT },
});

interface MediaListItem {
  type: string;
  title?: string;
}

interface ImageInfo {
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  mime: string;
}

async function fetchLeadImageUrl(pageTitle: string): Promise<string | null> {
  try {
    const { data } = await http.get<{
      originalimage?: { source: string; width: number; height: number };
    }>(`${WIKI_REST}/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`);
    const original = data.originalimage;
    if (!original || original.width < MIN_WIDTH || original.height < MIN_HEIGHT) return null;
    return original.source;
  } catch {
    return null;
  }
}

async function fetchArticleFileTitles(pageTitle: string): Promise<string[]> {
  try {
    const { data } = await http.get<{ items?: MediaListItem[] }>(
      `${WIKI_REST}/page/media-list/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
    );
    return (data.items ?? [])
      .filter((item) => item.type === 'image')
      .map((item) => item.title ?? '')
      .filter((title) => /\.jpe?g$/i.test(title) && !EXCLUDED_TITLE.test(title));
  } catch {
    return [];
  }
}

/** Batch-resolve Commons file titles into downloadable URLs (≤1600px wide). */
async function resolveFileUrls(fileTitles: string[]): Promise<string[]> {
  if (fileTitles.length === 0) return [];
  try {
    const { data } = await http.get<{
      query?: { pages?: Record<string, { imageinfo?: ImageInfo[] }> };
    }>(COMMONS_API, {
      params: {
        action: 'query',
        titles: fileTitles.slice(0, 50).join('|'),
        prop: 'imageinfo',
        iiprop: 'url|size|mime',
        iiurlwidth: MAX_SOURCE_WIDTH,
        format: 'json',
      },
    });
    const pages = Object.values(data.query?.pages ?? {});
    return pages
      .map((page) => page.imageinfo?.[0])
      .filter((info): info is ImageInfo => Boolean(info))
      .filter(
        (info) =>
          info.mime === 'image/jpeg' &&
          info.width >= MIN_WIDTH &&
          info.height >= MIN_HEIGHT &&
          // Landscape-ish shots only; portrait crops look bad in the gallery.
          info.width / info.height >= 1.1,
      )
      .map((info) => (info.width > MAX_SOURCE_WIDTH && info.thumburl ? info.thumburl : info.url));
  } catch {
    return [];
  }
}

/**
 * Returns an ordered, deduplicated pool of photo URLs for a model.
 * `pageTitles` are tried in order until at least `minPool` photos are found.
 */
export async function fetchModelPhotoPool(
  pageTitles: readonly string[],
  minPool = 6,
): Promise<string[]> {
  const pool: string[] = [];
  for (const pageTitle of pageTitles) {
    const [lead, fileTitles] = await Promise.all([
      fetchLeadImageUrl(pageTitle),
      fetchArticleFileTitles(pageTitle),
    ]);
    const resolved = await resolveFileUrls(fileTitles);
    const candidates = lead ? [lead, ...resolved] : resolved;
    for (const url of candidates) {
      if (!pool.includes(url)) pool.push(url);
    }
    if (pool.length >= minPool) break;
  }
  return pool;
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8]);

/** Downloads a photo and validates it is an actual JPEG, not an error page. */
export async function downloadPhoto(url: string): Promise<Buffer> {
  const { data } = await http.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(data);
  if (buffer.length < 1024 || !buffer.subarray(0, 2).equals(JPEG_MAGIC)) {
    throw new Error(`downloaded content from ${url} is not a JPEG`);
  }
  return buffer;
}
