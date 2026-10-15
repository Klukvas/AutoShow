import type { ListingMedia } from '../listings/entities/listing-media.entity';

export type PhotoAiCategory = 'enhance' | 'scene';
export type PhotoAiStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'interrupted';
export type PhotoAiRendition = {
  s3Key: string;
  variant: 'thumb' | 'gallery' | 'full';
  format: 'webp' | 'avif' | 'jpeg';
  width: number;
  height: number;
  sizeBytes: string;
};
export type PhotoAiManifest = {
  generationId: string;
  s3Key: string;
  width: number;
  height: number;
  sceneAltered: boolean;
  renditions: PhotoAiRendition[];
};
export function activeMedia(media: ListingMedia) {
  return {
    s3Key: media.activeAiVariant?.s3Key ?? media.originalS3Key,
    renditions:
      media.activeAiVariant?.renditions ?? (media.renditions ?? []).filter((r) => !r.deletedAt),
    sceneAltered: media.activeAiVariant?.sceneAltered ?? false,
  };
}
export function generationKeys(listingId: string, mediaId: string, id: string): string[] {
  const base = `listings/${listingId}/ai/${mediaId}/${id}`;
  return [
    `${base}/output.png`,
    ...['thumb', 'gallery', 'full'].flatMap((v) =>
      ['webp', 'avif', 'jpeg'].map((f) => `${base}/${v}.${f}`),
    ),
  ];
}
