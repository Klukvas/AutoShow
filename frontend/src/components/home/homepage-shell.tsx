'use client';

import { usePathname } from 'next/navigation';

/** Keep the cinematic palette local to the homepage, including its shared chrome. */
export function HomepageShell({ children }: { children: React.ReactNode }) {
  const isHomepage = usePathname() === '/';
  return (
    <div className={isHomepage ? 'homepage-cinematic homepage-shell bg-bg text-ink' : 'cinematic-interior bg-bg text-ink'}>
      {children}
    </div>
  );
}
