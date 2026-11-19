import { storefrontHttpUrl } from '@/lib/storefront/http-url';

const SOCIALS = ['instagram', 'tiktok', 'facebook', 'youtube'] as const;
type SocialKey = (typeof SOCIALS)[number];

/** Header icons for the networks a showroom actually filled in. Unsafe urls are omitted. */
export function HeaderSocial({
  links,
  labels,
}: {
  links: Record<string, string> | null | undefined;
  labels: Record<SocialKey, string>;
}) {
  const items = SOCIALS.flatMap((key) => {
    const href = storefrontHttpUrl(links?.[key]);
    return href ? [{ key, href }] : [];
  });
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={labels[item.key]}
          className="focus-ring flex h-9 w-9 items-center justify-center text-current"
        >
          <SocialGlyph name={item.key} />
        </a>
      ))}
    </div>
  );
}

function SocialGlyph({ name }: { name: SocialKey }) {
  const common = {
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    className: 'h-[18px] w-[18px] fill-none stroke-current',
    strokeWidth: 1.6,
  };
  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.2l.8-3H13V9c0-.6.4-1 1-1z" />
      </svg>
    );
  }
  if (name === 'youtube') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M11 10.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M9 8.5a4.5 4.5 0 1 0 5.2 6.3" />
      <path d="M14 7.2c.8 1.6 2.2 2.6 4 2.8" />
      <path d="M15.2 4.8v3.2h3.1" />
    </svg>
  );
}
