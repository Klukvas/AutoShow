import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ViewBeacon } from '@/components/listing/view-beacon';
import { getSiteBranding } from '@/lib/branding/resolve';
import { JsonLd } from '@/lib/seo/json-ld';
import { getListing, getListingModel } from '@/lib/storefront/listing-model';
import { Listing } from '@theme/listing';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [listing, branding] = await Promise.all([getListing(slug), getSiteBranding()]);
  if (!listing) return {};
  const titleBase = listing.seo.metaTitle ?? listing.title;
  // Same eligibility rule as the gallery: first IMAGE with processed renditions
  // (media[0] may be a video or an unprocessed upload).
  const ogMedia = listing.media.find((m) => m.type === 'image' && (m.renditions?.length ?? 0) > 0);
  const ogImage = ogMedia?.renditions.find((r) => r.variant === 'full' && r.format === 'jpeg')?.url;
  return {
    title: titleBase,
    description: listing.seo.metaDescription ?? branding?.seoDefaults?.description,
    alternates: { canonical: listing.seo.canonical },
    openGraph: {
      title: titleBase,
      description: listing.seo.metaDescription ?? undefined,
      url: listing.seo.canonical,
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;
  const model = await getListingModel(slug);
  if (!model) notFound();

  // Structured data and view counting belong to the route: a theme redraws the page,
  // but cannot change what search engines read or stop a visit from being counted.
  return (
    <>
      <JsonLd data={model.structuredData.listing} />
      <JsonLd data={model.structuredData.breadcrumbs} />
      <ViewBeacon listingId={model.listing.id} />
      <Listing model={model} />
    </>
  );
}
