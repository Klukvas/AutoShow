import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import type { TelegramSettings } from '../branding/entities/site-settings.entity';
import type { Listing } from '../listings/entities/listing.entity';
import type { ListingTelegramPost } from './entities/listing-telegram-post.entity';
import { TelegramPostService } from './telegram-post.service';

const SETTINGS: TelegramSettings = {
  botToken: '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  channels: [{ chatId: '@one', label: 'Main' }, { chatId: '@two' }],
  autoPublish: true,
};

const MEDIA = [
  {
    id: 'm2',
    type: 'image',
    status: 'ready',
    deletedAt: null,
    isCover: false,
    position: 1,
    originalS3Key: 'orig/2.jpg',
    renditions: [],
  },
  {
    id: 'm1',
    type: 'image',
    status: 'ready',
    deletedAt: null,
    isCover: true,
    position: 0,
    originalS3Key: 'orig/1.jpg',
    renditions: [{ variant: 'gallery', format: 'jpeg', s3Key: 'g/1.jpg' }],
  },
];

function publishedListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    status: 'published',
    deletedAt: null,
    title: 'BMW 520d',
    year: 2020,
    mileageKm: 10_000,
    engineVolumeL: '2.0',
    powerHp: 190,
    locationCity: 'Київ',
    priceAmount: '25000.00',
    priceCurrency: 'USD',
    slug: 'bmw-520d-2020',
    media: MEDIA,
    ...overrides,
  } as unknown as Listing;
}

function buildService(opts: {
  telegram?: TelegramSettings | null;
  listing?: Listing | null;
  posts?: Array<Partial<ListingTelegramPost>>;
}) {
  const postsRepo = {
    find: jest.fn(async () => opts.posts ?? []),
    count: jest.fn(async () => (opts.posts ?? []).length),
    create: jest.fn((row: Partial<ListingTelegramPost>) => row),
    save: jest.fn(async (row: Partial<ListingTelegramPost>) => row),
  };
  const listingsRepo = { findOne: jest.fn(async () => opts.listing ?? null) };
  const branding = { getCurrent: jest.fn(async () => ({ telegram: opts.telegram ?? null })) };
  const storage = { publicUrlFor: (key: string) => `https://media.test/${key}` };
  const api = {
    sendMediaGroup: jest.fn(async () => [{ message_id: 11 }, { message_id: 12 }]),
    sendPhoto: jest.fn(async () => ({ message_id: 21 })),
    editMessageCaption: jest.fn(async () => undefined),
  };
  const queue = { add: jest.fn(async () => undefined) };
  const config = { PUBLIC_SITE_URL: 'https://site.test' };
  const svc = new TelegramPostService(
    postsRepo as never,
    listingsRepo as never,
    branding as never,
    storage as never,
    api as never,
    queue as never,
    config as never,
  );
  return { svc, postsRepo, listingsRepo, branding, api, queue };
}

describe('TelegramPostService', () => {
  it('postListing is a no-op when telegram is not configured', async () => {
    const { svc, listingsRepo, api } = buildService({ telegram: null });
    await svc.postListing('l1');
    expect(listingsRepo.findOne).not.toHaveBeenCalled();
    expect(api.sendMediaGroup).not.toHaveBeenCalled();
  });

  it('postListing posts an album only to channels without an existing post', async () => {
    const { svc, api, postsRepo } = buildService({
      telegram: SETTINGS,
      listing: publishedListing(),
      posts: [{ chatId: '@one' }],
    });
    await svc.postListing('l1');
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(1);
    const [, chatId, media] = api.sendMediaGroup.mock.calls[0] as unknown as [
      string,
      string,
      unknown[],
    ];
    expect(chatId).toBe('@two');
    // cover-first ordering + jpeg rendition preferred over the original
    expect(media[0]).toMatchObject({ media: 'https://media.test/g/1.jpg', parse_mode: 'HTML' });
    expect(media[1]).toMatchObject({ media: 'https://media.test/orig/2.jpg' });
    expect(postsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'l1',
        chatId: '@two',
        messageIds: [11, 12],
        captionMessageId: 11,
      }),
    );
  });

  it('postListing uses sendPhoto for a single-photo listing', async () => {
    const { svc, api } = buildService({
      telegram: { ...SETTINGS, channels: [{ chatId: '@one' }] },
      listing: publishedListing({ media: [MEDIA[1]] } as Partial<Listing>),
    });
    await svc.postListing('l1');
    expect(api.sendPhoto).toHaveBeenCalledTimes(1);
    expect(api.sendMediaGroup).not.toHaveBeenCalled();
  });

  it('postListing skips listings without ready photos or no longer public', async () => {
    const noPhotos = buildService({
      telegram: SETTINGS,
      listing: publishedListing({ media: [] } as Partial<Listing>),
    });
    await noPhotos.svc.postListing('l1');
    expect(noPhotos.api.sendMediaGroup).not.toHaveBeenCalled();

    const archived = buildService({
      telegram: SETTINGS,
      listing: publishedListing({ status: 'archived' } as Partial<Listing>),
    });
    await archived.svc.postListing('l1');
    expect(archived.api.sendMediaGroup).not.toHaveBeenCalled();
  });

  it('enqueueManualPost rejects when unconfigured / unpublished / fully posted', async () => {
    await expect(
      buildService({ telegram: null }).svc.enqueueManualPost('l1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(
      buildService({
        telegram: SETTINGS,
        listing: publishedListing({ status: 'draft' } as Partial<Listing>),
      }).svc.enqueueManualPost('l1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(
      buildService({
        telegram: SETTINGS,
        listing: publishedListing(),
        posts: [{ chatId: '@one' }, { chatId: '@two' }],
      }).svc.enqueueManualPost('l1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enqueueManualPost queues a job for the remaining channels', async () => {
    const { svc, queue } = buildService({
      telegram: SETTINGS,
      listing: publishedListing(),
      posts: [{ chatId: '@one' }],
    });
    await expect(svc.enqueueManualPost('l1')).resolves.toEqual({ enqueuedChannels: 1 });
    expect(queue.add).toHaveBeenCalledWith('post', { listingId: 'l1' }, expect.anything());
  });

  it('enqueueAutoPost respects the autoPublish flag and never throws', async () => {
    const off = buildService({ telegram: { ...SETTINGS, autoPublish: false } });
    await off.svc.enqueueAutoPost('l1');
    expect(off.queue.add).not.toHaveBeenCalled();

    const broken = buildService({ telegram: SETTINGS });
    broken.branding.getCurrent.mockRejectedValueOnce(new Error('db down'));
    await expect(broken.svc.enqueueAutoPost('l1')).resolves.toBeUndefined();
  });

  it('markSoldPosts edits captions and tolerates a hand-deleted post', async () => {
    const { svc, api, postsRepo } = buildService({
      telegram: SETTINGS,
      listing: publishedListing({ status: 'sold' } as Partial<Listing>),
      posts: [
        { chatId: '@one', captionMessageId: 11, soldMarkedAt: null },
        { chatId: '@two', captionMessageId: 21, soldMarkedAt: null },
      ],
    });
    api.editMessageCaption.mockRejectedValueOnce(
      new Error('Telegram editMessageCaption failed: message to edit not found'),
    );
    await svc.markSoldPosts('l1');
    expect(api.editMessageCaption).toHaveBeenCalledTimes(2);
    // both rows get soldMarkedAt — the deleted post must not retry forever
    expect(postsRepo.save).toHaveBeenCalledTimes(2);
  });
});
