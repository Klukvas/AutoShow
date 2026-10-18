import { cn } from '@/lib/cn';

type Tone = 'warning' | 'error' | 'success' | 'info';

const TONE_CLS: Record<Tone, string> = {
  // Warning = the 409/lockout family: #FFF9EC / #F3E2B8 / #8A6300 tokens.
  warning: 'border-ratelimit-line bg-ratelimit-bg text-ratelimit',
  error: 'border-danger-line bg-danger-bg text-danger',
  success: 'border-st-published-fg/25 bg-st-published-bg text-st-published-fg',
  info: 'border-line bg-surface-2 text-ink-2',
};

/** Inline banner (409 conflict, rate-limit, save results). */
export function Banner({
  tone,
  children,
  action,
  className,
  role,
}: {
  tone: Tone;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Override for a standing state shown on load, which should not interrupt like an alert. */
  role?: 'alert' | 'status';
}) {
  return (
    <div
      role={role ?? (tone === 'error' || tone === 'warning' ? 'alert' : 'status')}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-none border px-4 py-3 text-[0.8125rem] font-medium',
        TONE_CLS[tone],
        className,
      )}
    >
      <span aria-hidden className="text-[0.9375rem] leading-none">
        {tone === 'success' ? '✓' : tone === 'info' ? 'ℹ' : '⚠'}
      </span>
      <span className="flex-1 leading-snug">{children}</span>
      {action}
    </div>
  );
}
