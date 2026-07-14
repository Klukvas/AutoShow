import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';

const editor: AuthenticatedUser = { id: 'editor-1', email: 'editor@example.com', role: 'editor' };

describe('MediaService', () => {
  const makeService = () => {
    const media = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      softRemove: jest.fn(),
    };
    const renditions = {
      find: jest.fn(),
      softDelete: jest.fn(),
    };
    const listings = { findOne: jest.fn() };
    const storage = {
      presignPut: jest.fn(),
      head: jest.fn(),
      delete: jest.fn(async () => undefined),
    };
    const audit = { record: jest.fn() };
    const queue = { add: jest.fn(), remove: jest.fn().mockResolvedValue(undefined) };
    const service = new MediaService(
      media as never,
      renditions as never,
      listings as never,
      storage as never,
      audit as never,
      queue as never,
      { MEDIA_MAX_BYTES: 20_000_000 } as never,
    );
    return { service, media, renditions, listings, storage, audit };
  };

  it('rejects a declared media type that does not match the MIME type', async () => {
    const { service, listings } = makeService();

    await expect(
      service.beginUpload('listing-1', {
        type: 'image',
        contentType: 'video/mp4',
        filename: 'clip.mp4',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(listings.findOne).not.toHaveBeenCalled();
  });

  it('derives the object extension from the validated MIME type', async () => {
    const { service, listings, storage, media } = makeService();
    listings.findOne.mockResolvedValue({ id: 'listing-1' });
    storage.presignPut.mockResolvedValue({ uploadUrl: 'url', expiresIn: 60 });
    media.save.mockImplementation(async (value) => ({ ...value, id: 'media-1' }));

    const result = await service.beginUpload('listing-1', {
      type: 'image',
      contentType: 'image/jpeg',
      filename: 'payload.html',
      sizeBytes: 100,
    });

    expect(result.key).toMatch(/^listings\/listing-1\/original\//);
    expect(result.key).toMatch(/\.jpg$/);
    expect(result.key).not.toContain('.html');
  });

  it('rejects an uploaded object whose content type changed', async () => {
    const { service, media, storage } = makeService();
    const row = {
      id: 'media-1',
      listingId: 'listing-1',
      originalS3Key: 'original.jpg',
      type: 'image',
      mime: 'image/jpeg',
      status: 'pending',
    };
    media.findOne.mockResolvedValue(row);
    storage.head.mockResolvedValue({ size: 100, contentType: 'video/mp4' });

    await expect(service.confirm('media-1', editor)).rejects.toBeInstanceOf(BadRequestException);
    expect(media.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failureReason: 'uploaded content type does not match requested media type',
      }),
    );
  });

  it('deletes the original and all generated renditions', async () => {
    const { service, media, renditions, storage, audit } = makeService();
    media.findOne.mockResolvedValue({
      id: 'media-1',
      originalS3Key: 'original.jpg',
    });
    renditions.find.mockResolvedValue([{ s3Key: 'thumb.webp' }, { s3Key: 'full.avif' }]);

    await service.remove('media-1', editor);

    expect(renditions.softDelete).toHaveBeenCalledWith({ mediaId: 'media-1' });
    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(storage.delete).toHaveBeenCalledWith('original.jpg');
    expect(storage.delete).toHaveBeenCalledWith('thumb.webp');
    expect(storage.delete).toHaveBeenCalledWith('full.avif');
    expect(audit.record).toHaveBeenCalled();
  });

  it('keeps the database row active when storage deletion fails', async () => {
    const { service, media, renditions, storage } = makeService();
    media.findOne.mockResolvedValue({
      id: 'media-1',
      originalS3Key: 'original.jpg',
    });
    renditions.find.mockResolvedValue([]);
    storage.delete.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.remove('media-1', editor)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(media.softRemove).not.toHaveBeenCalled();
    expect(renditions.softDelete).not.toHaveBeenCalled();
  });
});
