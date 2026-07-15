import { getTranslations } from 'next-intl/server';
import { publicApi } from '@/lib/api/public';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-[13px] tracking-[2px] text-warn-strong">
      {'★'.repeat(Math.max(1, Math.min(5, rating)))}
      <span className="text-line-strong">{'★'.repeat(5 - Math.max(1, Math.min(5, rating)))}</span>
    </span>
  );
}

/** Homepage testimonials (admin-curated, hidden while there are none). */
export async function ReviewsSection() {
  const t = await getTranslations('home');
  let reviews: Awaited<ReturnType<typeof publicApi.listReviews>> = [];
  try {
    reviews = await publicApi.listReviews({ revalidate: 300 });
  } catch {
    return null;
  }
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <h2 className="font-heading text-title-lg font-extrabold text-ink">{t('reviewsTitle')}</h2>
      <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 6).map((review, idx) => (
          <ScrollReveal key={review.id} delay={Math.min(idx, 5) * 0.05}>
            <figure className="flex h-full flex-col rounded-card border border-line bg-surface p-5">
              <Stars rating={review.rating} />
              <blockquote className="mt-3 flex-1 text-body-md leading-relaxed text-ink-2">
                “{review.text}”
              </blockquote>
              <figcaption className="mt-4 text-sub font-semibold text-ink">
                {review.authorName}
                {review.city && <span className="font-medium text-ink-3"> · {review.city}</span>}
              </figcaption>
            </figure>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
