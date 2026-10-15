'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

const traps: HTMLElement[] = [];

export function isTopFocusTrap(element: HTMLElement | null): boolean {
  return element !== null && traps[traps.length - 1] === element;
}

/**
 * Minimal focus trap for modal dialogs (`aria-modal` alone does not constrain
 * real DOM focus for sighted keyboard users). While `active`:
 *   - moves focus to `[data-autofocus]` (or the first focusable descendant),
 *   - cycles Tab / Shift+Tab within the container,
 *   - restores focus to the previously focused element on close.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    traps.push(container);
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          !element.closest('[inert], [aria-hidden="true"]') &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden',
      );

    const previousTabIndex = container.getAttribute('tabindex');
    if (previousTabIndex === null) container.tabIndex = -1;
    const focusFirst = () => {
      const items = focusables();
      (items.find((item) => item.hasAttribute('data-autofocus')) ?? items[0] ?? container).focus({
        preventScroll: true,
      });
    };
    focusFirst();

    const onFocus = (event: FocusEvent) => {
      if (isTopFocusTrap(container) && !container.contains(event.target as Node)) focusFirst();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !isTopFocusTrap(container)) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      const wasTop = isTopFocusTrap(container);
      const index = traps.lastIndexOf(container);
      if (index >= 0) traps.splice(index, 1);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
      if (previousTabIndex === null) container.removeAttribute('tabindex');
      if (wasTop && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
