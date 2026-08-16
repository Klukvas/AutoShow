import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { CollectionsManager } from '@/components/admin/collections/collections-manager';

export const dynamic = 'force-dynamic';

/** Curated SEO collections CRUD — admin-only. Editors get bounced (nav hides it). */
export default async function AdminCollectionsPage() {
  const auth = await requireServerToken('/admin/collections');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const collections = await adminApi.listCollections({ accessToken: auth.accessToken });

  return (
    <div className="mx-auto max-w-[820px]">
      <CollectionsManager initial={collections} />
    </div>
  );
}
