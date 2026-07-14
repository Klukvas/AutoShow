'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portals a page's primary action (e.g. «+ Створити») into the mobile top
 * bar slot rendered by AdminSidebar. Desktop keeps the action in the page
 * header; this slot only exists under md.
 */
export function TopbarAction({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-topbar-action'));
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
