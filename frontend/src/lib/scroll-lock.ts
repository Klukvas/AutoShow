/**
 * Reference-counted body scroll lock. Three overlays can be open in overlapping
 * windows (nav drawer, gallery lightbox, mobile filter sheet) — a naive
 * `document.body.style.overflow = ''` cleanup from one would unlock the page
 * while another is still open. The counter makes lock/unlock pairs composable.
 */
let lockCount = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}
