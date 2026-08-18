import { type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EyebrowProps {
  children: ReactNode;
  /** 'muted' — ink-2 label (default; AA on paper); 'gold' — catalogue accent. */
  tone?: 'muted' | 'gold';
  as?: ElementType;
  className?: string;
}

/**
 * The Paper Lot eyebrow voice: mono, uppercase, tracked. One source of truth
 * for kickers, column labels and field labels so their size/tracking/tone stop
 * drifting. 'muted' is ink-2 (not ink-3) to stay AA on the warm surface.
 */
export function Eyebrow({ children, tone = 'muted', as: Tag = 'span', className }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        'font-mono text-[0.625rem] font-bold uppercase tracking-[0.18em]',
        tone === 'gold' ? 'text-lot-gold' : 'text-ink-2',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
