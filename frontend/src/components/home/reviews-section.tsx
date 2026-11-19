import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ReviewsCarousel } from './reviews-carousel';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { reviewMedia } from '@/lib/storefront/review-media';
import type { PublicReview } from '@/lib/api/types';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-[0.8125rem] tracking-[2px] text-lot-gold">
      {'★'.repeat(Math.max(1, Math.min(5, rating)))}
      <span className="text-line-strong">{'★'.repeat(5 - Math.max(1, Math.min(5, rating)))}</span>
    </span>
  );
}

function ReviewMedia({
  review,
  watchLabel,
  reelLabel,
}: {
  review: PublicReview;
  watchLabel: string;
  reelLabel: string;
}) {
  const media = reviewMedia(review.mediaUrl);
  if (!media) return null;
  if (media.kind === 'image') {
    return (
      <span className="home-review-media">
        <Image
          src={media.src}
          alt=""
          fill
          sizes="(max-width: 767px) 85vw, 320px"
          className="object-cover"
        />
      </span>
    );
  }
  return (
    <a
      className="home-review-media home-review-play focus-ring"
      href={media.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {media.platform === 'youtube' ? watchLabel : reelLabel}
    </a>
  );
}

interface ReviewsSectionProps {
  reviews: PublicReview[];
}

/** Homepage testimonials. Photos and video links scroll in one strip. */
export async function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const t = await getTranslations('home');
  if (reviews.length === 0) return null;

  return (
    <section className="home-container home-section">
      <ScrollReveal>
        <HomeSectionHeading title={t('reviewsTitle')} />
      </ScrollReveal>
      <ReviewsCarousel previousLabel={t('reviewsPrev')} nextLabel={t('reviewsNext')}>
        {reviews.slice(0, 8).map((review) => (
          <figure key={review.id} className="home-review">
            <ReviewMedia
              review={review}
              watchLabel={t('reviewsWatch')}
              reelLabel={t('reviewsReel')}
            />
            <Stars rating={review.rating} />
            <blockquote className="mt-3 flex-1 text-body-md leading-relaxed text-ink-2">
              “{review.text}”
            </blockquote>
            <figcaption className="mt-4 text-sub font-semibold text-ink">
              {review.authorName}
              {review.city && <span className="font-medium text-ink-3"> · {review.city}</span>}
            </figcaption>
          </figure>
        ))}
      </ReviewsCarousel>
    </section>
  );
}
