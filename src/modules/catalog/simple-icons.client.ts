import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons';
const HTTP_TIMEOUT_MS = 15_000;
const ICON_SIZE = 512;
/**
 * One neutral gray for every brand (matches the UI's ink-3 token in light
 * theme) — legible on both light and dark surfaces, since the PNG sits
 * directly on the theme background with no backing plate.
 */
const ICON_COLOR = '#8C929E';

export interface RenderedIcon {
  buffer: Buffer;
  contentType: 'image/png';
}

/**
 * Brand glyphs from simple-icons (via jsDelivr, keyless): strictly monochrome
 * single-path SVGs in one visual style. We rasterize to a 512px transparent
 * PNG in a fixed ink tone, so every make icon on the site looks uniform.
 * Coverage is narrower than colored-logo datasets — a miss falls back to the
 * letter avatar in the UI, which fits the same monochrome style.
 */
@Injectable()
export class SimpleIconsClient {
  private readonly logger = new Logger(SimpleIconsClient.name);
  private readonly http = axios.create({ timeout: HTTP_TIMEOUT_MS });

  async fetchIcon(slug: string, nameEn: string | null): Promise<RenderedIcon | null> {
    for (const candidate of this.slugCandidates(slug, nameEn)) {
      const svg = await this.download(candidate);
      if (!svg) continue;
      const rendered = await this.render(svg, candidate);
      if (rendered) return rendered;
    }
    return null;
  }

  /**
   * simple-icons slugs are lowercase alphanumerics of the brand title:
   * 'alfa-romeo' → 'alfaromeo', but 'mercedes-benz' is published as plain
   * 'mercedes' — so the first name token is tried as well.
   */
  private slugCandidates(slug: string, nameEn: string | null): string[] {
    const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidates = [
      norm(slug),
      norm(slug.split('-')[0]),
      nameEn ? norm(nameEn) : '',
      nameEn ? norm(nameEn.split(/\s+/)[0]) : '',
    ];
    return [...new Set(candidates.filter((c) => c.length > 1))];
  }

  private async download(iconSlug: string): Promise<string | null> {
    try {
      const res = await this.http.get<string>(`${CDN_BASE}/${iconSlug}.svg`, {
        responseType: 'text',
        validateStatus: () => true,
      });
      if (res.status !== 200 || !String(res.data).includes('<svg')) return null;
      return String(res.data);
    } catch (err) {
      this.logger.warn({ iconSlug, err }, 'simple-icons download failed');
      return null;
    }
  }

  private async render(svg: string, iconSlug: string): Promise<RenderedIcon | null> {
    try {
      // simple-icons paths inherit the root fill — bake our ink tone in.
      const tinted = svg.replace('<svg ', `<svg fill="${ICON_COLOR}" `);
      const buffer = await sharp(Buffer.from(tinted), { density: 300 })
        .resize(ICON_SIZE, ICON_SIZE, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      return { buffer, contentType: 'image/png' };
    } catch (err) {
      this.logger.warn({ iconSlug, err }, 'simple-icons render failed');
      return null;
    }
  }
}
