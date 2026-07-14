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
 * Used for editorial slabs and listing cards (§7). Anything more elaborate
 * starts reading as "AI-generated" — strictly one-shot, no infinite hover.
 */
export function ScrollReveal({
  children,
  delay = 0,
  offset = 24,
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
        duration: reduceMotion ? 0 : 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay,
      },
    },
  };

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
