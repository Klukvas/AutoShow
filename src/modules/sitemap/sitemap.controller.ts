import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SitemapService } from './sitemap.service';

@Public()
@Controller()
export class SitemapController {
  constructor(private readonly sitemap: SitemapService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint()
  async sitemapXml() {
    return this.sitemap.build();
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @ApiExcludeEndpoint()
  robots() {
    return this.sitemap.robots();
  }
}
