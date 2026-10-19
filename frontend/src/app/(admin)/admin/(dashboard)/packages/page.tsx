import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { PackagesManager } from '@/components/admin/packages/packages-manager';

export const dynamic = 'force-dynamic';

/** Homepage placement tariffs CRUD — admin-only. Editors get bounced (nav hides it). */
export default async function AdminPackagesPage() {
  const auth = await requireServerToken('/admin/packages');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const packages = await adminApi.listPlacementPackages({ accessToken: auth.accessToken });

  return (
    <div className="mx-auto max-w-[760px]">
      <PackagesManager initial={packages} />
    </div>
  );
}
