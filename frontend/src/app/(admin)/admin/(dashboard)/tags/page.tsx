import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import type { CatalogTag } from '@/lib/api/types';
import { requireServerToken } from '@/lib/auth/refresh';
import { TagsManager } from '@/components/admin/tags/tags-manager';

export const dynamic = 'force-dynamic';

/** Curated tag dictionary CRUD — admin-only. Editors get bounced (nav hides it). */
export default async function AdminTagsPage() {
  const auth = await requireServerToken('/admin/tags');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const tags: CatalogTag[] = await adminApi
    .listTags({ accessToken: auth.accessToken })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-[820px]">
      <TagsManager initial={tags} />
    </div>
  );
}
