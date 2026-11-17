import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCatalogModel } from '@/lib/storefront/catalog-model';
import type { CatalogSearchParams } from '@/lib/storefront/catalog-query';
import { Catalog } from '@theme/catalog';

export const revalidate = 30;

interface CatalogPageProps {
  searchParams: Promise<CatalogSearchParams>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog');
  return { title: t('title') };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const model = await getCatalogModel(await searchParams);
  return <Catalog model={model} />;
}
