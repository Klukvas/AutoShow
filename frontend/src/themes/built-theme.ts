import { themeId as bundledThemeId } from '@theme/id';

/**
 * The requested theme id, once the bundle is proven to contain that theme.
 * `requested` is what next.config.mjs validated and inlined; `bundled` is the id the
 * folder behind `@theme/*` reports about itself. They differ when a bundler ignores the
 * `@theme` rewrite of next.config.mjs (Turbopack does) and falls back to the tsconfig
 * path, i.e. the `current` folder — such a build would ship one design under another
 * design's name, so it must fail instead.
 */
export function verifiedThemeId(requested: string | undefined, bundled: string): string {
  if (!requested) {
    throw new Error('STOREFRONT_THEME was not inlined: build or run through next.config.mjs');
  }
  if (requested !== bundled) {
    throw new Error(
      `Storefront theme mismatch: STOREFRONT_THEME=${JSON.stringify(requested)} was requested, ` +
        `but the bundled theme folder identifies itself as ${JSON.stringify(bundled)} (@theme/id). ` +
        'Either the bundler ignored the @theme rewrite of next.config.mjs and fell back to ' +
        'src/themes/current/ (Turbopack does: build with webpack), or the id.ts of that ' +
        'folder does not name its folder.',
    );
  }
  return bundled;
}

/**
 * Id of the theme this image was built with. next.config.mjs validates
 * `STOREFRONT_THEME` and inlines it here at build time (`env`), so changing the
 * variable on a running server has no effect: the design needs a new build.
 * Evaluated when a route module loads, which `next build` does for every route.
 */
export const builtThemeId: string = verifiedThemeId(process.env.STOREFRONT_THEME, bundledThemeId);
