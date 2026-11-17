import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getCollectionModel,
  getCollectionPreset,
  listCollectionKeys,
} from '@/lib/storefront/collection-model';
import { Collection } from '@theme/collection';

interface PageProps {
  params: Promise<{ key: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  const keys = await listCollectionKeys();
  return keys.map((key) => ({ key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const preset = await getCollectionPreset(key);
  if (!preset) return {};
  return {
    title: preset.titleUk,
    description: preset.descriptionUk ?? undefined,
    alternates: { canonical: `/collections/${preset.key}` },
  };
}

/** Curated SEO landing: a filter preset with its own copy and URL. */
export default async function CollectionPage({ params }: PageProps) {
  const { key } = await params;
  const model = await getCollectionModel(key);
  if (!model) notFound();

  return <Collection model={model} />;
}
