import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import type { Collection } from '@/lib/api/types';
import { requireServerToken } from '@/lib/auth/refresh';
import { CollectionsManager } from '@/components/admin/collections/collections-manager';

export const dynamic = 'force-dynamic';

/** Curated SEO collections CRUD — admin-only. Editors get bounced (nav hides it). */
export default async function AdminCollectionsPage() {
  const auth = await requireServerToken('/admin/collections');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const collections: Collection[] = await adminApi
    .listCollections({ accessToken: auth.accessToken })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-[820px]">
      <CollectionsManager initial={collections} />
    </div>
  );
}
