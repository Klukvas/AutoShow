import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { ListingAiInputService } from './listing-ai-input.service';

/** AI listing descriptions. Grows with the later steps (provider, worker, API). */
@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [ListingAiInputService],
  exports: [ListingAiInputService],
})
export class ListingAiModule {}
