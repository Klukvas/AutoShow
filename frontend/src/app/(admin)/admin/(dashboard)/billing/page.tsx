import { redirect } from 'next/navigation';
import { requireServerToken } from '@/lib/auth/refresh';
import { readBillingInvoices, readBillingStatus } from '@/lib/admin/billing-server';
import { BillingPanel } from '@/components/admin/billing/billing-panel';

export const dynamic = 'force-dynamic';

/**
 * Admin-only: hosting subscription status, «Оплатити» and payment history.
 * While billing is blocked this is the only page an admin can reach.
 */
export default async function AdminBillingPage() {
  const auth = await requireServerToken('/admin/billing');
  // Request-cached: the layout already fetched it for this render.
  const status = await readBillingStatus(auth.accessToken);
  if (auth.session.user.role !== 'admin') {
    // Blocked editors stay here: the layout shows them the unpaid notice.
    if (status?.blocked) return null;
    redirect('/admin/listings');
  }
  // The error boundary handles it; the panel cannot render without a status.
  if (!status) throw new Error('Billing status is unavailable');
  const invoices = await readBillingInvoices(auth.accessToken);

  return (
    <div className="mx-auto max-w-[960px]">
      <BillingPanel status={status} invoices={invoices} />
    </div>
  );
}
