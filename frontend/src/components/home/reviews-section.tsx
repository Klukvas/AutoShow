import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import type { PublicReview } from '@/lib/api/types';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-[0.8125rem] tracking-[2px] text-lot-gold">
      {'★'.repeat(Math.max(1, Math.min(5, rating)))}
      <span className="text-line-strong">{'★'.repeat(5 - Math.max(1, Math.min(5, rating)))}</span>
    </span>
  );
}

interface ReviewsSectionProps {
  reviews: PublicReview[];
}

/** Homepage testimonials (admin-curated, hidden while there are none). */
export async function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const t = await getTranslations('home');
  if (reviews.length === 0) return null;

  return (
    <section className="home-container home-section">
      <HomeSectionHeading title={t('reviewsTitle')} />
      <div className="home-reviews-grid">
        {reviews.slice(0, 6).map((review, idx) => (
          <ScrollReveal key={review.id} delay={Math.min(idx, 5) * 0.05}>
            <figure className="home-review">
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
