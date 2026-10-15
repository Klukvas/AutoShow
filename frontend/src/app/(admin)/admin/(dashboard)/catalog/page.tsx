import { requireServerToken } from '@/lib/auth/refresh';
import { CatalogManager } from '@/components/admin/catalog/catalog-manager';

export const dynamic = 'force-dynamic';
export default async function AdminCatalogPage() {
  const auth = await requireServerToken('/admin/catalog');
  return <CatalogManager role={auth.session.user.role} />;
}
