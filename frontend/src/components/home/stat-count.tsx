'use client';

import { animate, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders `value` on the server, then counts from 0 once the number is on screen.
 * The first paint matches the server text. Reduced motion keeps the value.
 */
export function StatCount({ value, locale }: { value: number; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const [current, setCurrent] = useState(value);
  const formatted = value.toLocaleString(locale);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !inView) {
      setCurrent(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1,
      ease: 'easeOut',
      onUpdate: (latest) => setCurrent(Math.round(latest)),
      onComplete: () => setCurrent(value),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} style={{ display: 'inline-block', minWidth: `${formatted.length}ch` }}>
      {current.toLocaleString(locale)}
    </span>
  );
}
