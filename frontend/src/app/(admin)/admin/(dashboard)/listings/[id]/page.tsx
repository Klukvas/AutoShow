import { notFound, redirect } from 'next/navigation';

/**
 * The redesign folds the old read-only detail screen into the edit surface
 * (handoff 1d/1e). Old bookmarks land here — send them to /edit.
 */
export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  redirect(`/admin/listings/${id}/edit`);
}
