export type ReviewMedia =
  | { kind: 'image'; src: string }
  | { kind: 'video'; href: string; platform: 'youtube' | 'instagram' };

/** Decode a few times so `%2e%2e` cannot stand in for `..`, then reject traversal. */
function localPhoto(value: string): string | null {
  let path = value;
  for (let i = 0; i < 5; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (decoded === path) break;
    path = decoded;
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

/** A homepage review photo or a YouTube / Instagram link. Anything else is dropped. */
export function reviewMedia(value: string | null | undefined): ReviewMedia | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const photo = localPhoto(trimmed);
  if (photo) return { kind: 'image', src: photo };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    return { kind: 'video', href: url.toString(), platform: 'youtube' };
  }
  if (host === 'instagram.com') {
    return { kind: 'video', href: url.toString(), platform: 'instagram' };
  }
  return null;
}
