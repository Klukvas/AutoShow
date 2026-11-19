'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  /** Higher = larger initial offset before settle. */
  offset?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
}

/**
 * Fade and a short rise on enter. The default travel is large enough to read
 * on a laptop (28px, 0.55s, ease-out, no overshoot) and plays once.
 * Reduced motion skips the offset and the delay.
 */
export function ScrollReveal({
  children,
  delay = 0,
  offset = 28,
  className,
  as = 'div',
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  const variants: Variants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : offset },
    shown: {
      opacity: 1,
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : {
            type: 'tween',
            duration: 0.55,
            ease: 'easeOut',
            delay: Math.min(delay, 0.15),
          },
    },
  };

  return (
    <MotionTag
      className={['home-reveal', className].filter(Boolean).join(' ')}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? 'shown' : undefined}
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
