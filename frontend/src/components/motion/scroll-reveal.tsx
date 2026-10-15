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
 * Single, disciplined reveal primitive: fade + small translateY on enter.
 * Tuned for the "Paper Lot" editorial storefront — a short, restrained settle
 * (small offset, quick ease-out, no overshoot) reads like print laying down
 * rather than springy/bouncy motion. Strictly one-shot, no infinite hover.
 */
export function ScrollReveal({
  children,
  delay = 0,
  offset = 12,
  className,
  as = 'div',
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  const variants: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : offset },
    shown: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0,
        duration: reduceMotion ? 0.12 : 0.35,
        delay: reduceMotion ? 0 : Math.min(delay, 0.15),
      },
    },
  };

  return (
    <MotionTag
      className={className}
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
