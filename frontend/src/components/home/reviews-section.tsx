import { getTranslations } from 'next-intl/server';
import { SectionHeading } from '@/components/ui/section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import type { PublicReview } from '@/lib/api/types';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-[13px] tracking-[2px] text-warn-strong">
      {'★'.repeat(Math.max(1, Math.min(5, rating)))}
      <span className="text-line-strong">{'★'.repeat(5 - Math.max(1, Math.min(5, rating)))}</span>
    </span>
  );
}

interface ReviewsSectionProps {
  reviews: PublicReview[];
  index: string;
}

/** Homepage testimonials (admin-curated, hidden while there are none). */
export async function ReviewsSection({ reviews, index }: ReviewsSectionProps) {
  const t = await getTranslations('home');
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <SectionHeading index={index} title={t('reviewsTitle')} />
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
