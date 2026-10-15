'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep modal focus and scroll ownership until its exit has actually finished. */
export function useOverlayPresence(open: boolean) {
  const [exiting, setExiting] = useState(open);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (open) setExiting(true);
  }, [open]);

  const onExitComplete = useCallback(() => {
    if (!openRef.current) setExiting(false);
  }, []);

  return { present: open || exiting, onExitComplete };
}
