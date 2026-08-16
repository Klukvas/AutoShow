import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { ReviewsManager } from '@/components/admin/reviews/reviews-manager';

export const dynamic = 'force-dynamic';

/** Homepage testimonials CRUD — admin-only. Editors get bounced (nav hides it). */
export default async function AdminReviewsPage() {
  const auth = await requireServerToken('/admin/reviews');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const reviews = await adminApi.listReviews({ accessToken: auth.accessToken });

  return (
    <div className="mx-auto max-w-[760px]">
      <ReviewsManager initial={reviews} />
    </div>
  );
}
