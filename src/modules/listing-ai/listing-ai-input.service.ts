import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Listing } from '../listings/entities/listing.entity';
import {
  buildListingAiInput,
  listingAiInputHash,
  selectListingAiPhotos,
  type ListingAiInput,
  type ListingAiPhoto,
} from './listing-ai.input';

export type ListingAiInputSnapshot = {
  input: ListingAiInput;
  photos: ListingAiPhoto[];
  inputHash: string;
};

const RELATIONS = [
  'make',
  'model',
  'bodyType',
  'fuelType',
  'transmission',
  'driveType',
  'color',
  'options',
  'options.option',
  'tags',
  'tags.tag',
  'media',
  'media.renditions',
];

/** Loads a listing and turns it into the whitelisted model input. */
@Injectable()
export class ListingAiInputService {
  constructor(@InjectRepository(Listing) private readonly listings: Repository<Listing>) {}

  async snapshot(listingId: string): Promise<ListingAiInputSnapshot> {
    // withDeleted: a make or colour retired from the catalog is still this
    // car's make or colour. The listing itself must be alive; options, tags
    // and media apply their own deletedAt filters in the pure builders.
    const listing = await this.listings.findOne({
      where: { id: listingId },
      relations: RELATIONS,
      withDeleted: true,
    });
    if (!listing || listing.deletedAt) throw new NotFoundException('Оголошення не знайдено.');
    const input = buildListingAiInput(listing);
    const photos = selectListingAiPhotos(listing.media ?? []);
    return { input, photos, inputHash: listingAiInputHash(input, photos) };
  }
}
