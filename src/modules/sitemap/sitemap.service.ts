import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { Listing } from '../listings/entities/listing.entity';

@Injectable()
export class SitemapService {
  private readonly siteUrl: string;

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @Inject('APP_CONFIG') config: AppConfig,
  ) {
    this.siteUrl = config.PUBLIC_SITE_URL.replace(/\/+$/, '');
  }

  async build(): Promise<string> {
    // Every publicly reachable detail page: reserved/sold stay live with a
    // status badge, so they belong in the sitemap too.
    const items = await this.listings.find({
      where: { status: In(['published', 'reserved', 'sold']), deletedAt: IsNull() },
      select: ['slug', 'updatedAt'],
      order: { publishedAt: 'DESC' },
      take: 50_000,
    });
    const urls = items
      .map((l) => {
        const loc = `${this.siteUrl}/cars/${l.slug}`;
        const lastmod = l.updatedAt.toISOString();
        return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
      })
      .join('\n');
    // Curated SEO collections — keep in sync with the storefront's
    // frontend/src/lib/collections.ts preset keys.
    const collections = ['family', 'budget', 'electric', 'business', 'suv']
      .map((key) => `  <url><loc>${this.siteUrl}/collections/${key}</loc></url>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${this.siteUrl}/</loc></url>
  <url><loc>${this.siteUrl}/cars</loc></url>
${collections}
${urls}
</urlset>`;
  }

  robots(): string {
    // AI crawlers are deliberately allowed: listings surfacing in AI-assistant
    // answers (ChatGPT/Perplexity/Claude) bring buyers to a dealership. The
    // explicit per-bot groups document that decision — flip any of them to
    // `Disallow: /` to opt out (e.g. of model training) without touching the
    // default group.
    const aiBots = [
      'GPTBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'ClaudeBot',
      'Claude-User',
      'PerplexityBot',
      'Google-Extended',
      'CCBot',
    ];
    const aiGroups = aiBots
      .map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /admin`)
      .join('\n\n');
    return `User-agent: *
Allow: /
Disallow: /admin

${aiGroups}

Sitemap: ${this.siteUrl}/sitemap.xml
`;
  }
}
