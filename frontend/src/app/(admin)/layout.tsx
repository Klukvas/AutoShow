import type { Metadata } from 'next';

/**
 * Route-group layout for everything under /admin: the back office (including
 * the login page) must never appear in search results. Crawling is also
 * blocked in robots.txt; the meta tag covers pages reached via external links.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
