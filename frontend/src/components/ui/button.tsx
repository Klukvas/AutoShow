import { forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'solid' | 'ghost';

interface BaseProps {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

/**
 * Handoff button system: accent-filled primary, ink-outlined secondary, solid
 * ink for error/recovery actions, quiet ghost for tertiary CTAs. Radius and
 * height follow the 9–13px / 38–50px bands; ≥44px touch targets at md/lg.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent border border-accent hover:bg-accent-hover hover:border-accent-hover',
  outline: 'bg-surface text-ink border-[1.5px] border-ink hover:bg-ink/[0.04]',
  solid: 'bg-ink text-surface border border-ink hover:opacity-90',
  ghost: 'bg-transparent text-ink-2 border border-line-input hover:border-line-hover hover:text-ink',
};

const SIZE = {
  sm: 'h-[38px] px-4 text-[13.5px] rounded-btn',
  md: 'h-11 px-5 text-sub rounded-input',
  lg: 'h-[50px] px-6 text-[15px] rounded',
} as const;

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold select-none transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50';

type ButtonProps = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };

type AnchorProps = BaseProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string };

type LinkProps = BaseProps & {
  as: 'link';
  href: string;
  prefetch?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

type Props = ButtonProps | AnchorProps | LinkProps;

export const Button = forwardRef<HTMLElement, Props>((props, ref) => {
  const { variant = 'primary', size = 'md', className, children } = props;
  const classes = cn(BASE, SIZE[size], VARIANT[variant], className);

  if (props.as === 'link') {
    return (
      <Link
        href={props.href}
        prefetch={props.prefetch}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        onClick={props.onClick}
      >
        {children}
      </Link>
    );
  }

  if (props.as === 'a') {
    const { as: _as, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    return (
      <a {...rest} ref={ref as React.Ref<HTMLAnchorElement>} className={classes}>
        {children}
      </a>
    );
  }

  const { as: _as2, variant: _v2, size: _s2, className: _c2, children: _ch2, ...rest } = props;
  return (
    <button {...rest} ref={ref as React.Ref<HTMLButtonElement>} className={classes}>
      {children}
    </button>
  );
});
Button.displayName = 'Button';
