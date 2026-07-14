import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { BrandingEditor } from '@/components/admin/branding/branding-editor';

export const dynamic = 'force-dynamic';

/** Handoff 1h — admin-only (an editor's PATCH would 403 anyway). */
export default async function AdminBrandingPage() {
  const auth = await requireServerToken('/admin/branding');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');
  const branding = await adminApi.getBranding({ accessToken: auth.accessToken });

  return (
    <div className="mx-auto max-w-[960px]">
      <BrandingEditor initial={branding} />
    </div>
  );
}
