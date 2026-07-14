import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
