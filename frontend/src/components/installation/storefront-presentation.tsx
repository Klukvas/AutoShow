import type { PublicInstallation } from '@/lib/installation/config';
import { fonts } from '@theme/fonts';
import { builtThemeId } from '@/themes/built-theme';
import { themeFontCss } from '@/themes/theme-font-css';

// Fixed for the image, like the theme itself: computed once, not per request.
const fontCss = themeFontCss(builtThemeId, fonts);

/**
 * Presentation markers for the public subtree. The theme is the one this image was
 * built with; the font preset is still runtime installation config. The marker is also
 * what scopes the theme's tokens (`@theme/tokens.css`) and fonts to the storefront:
 * both are set on the `<body>` that contains it (themes/contract.ts `storefrontScope`).
 */
export function StorefrontPresentation({
  installation,
  children,
}: {
  installation: PublicInstallation;
  children: React.ReactNode;
}) {
  return (
    <div data-storefront-theme={builtThemeId} data-storefront-font={installation.fontPreset}>
      {fontCss ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: fontCss }} />
          {children}
        </>
      ) : (
        // The only child, not a sibling of an empty slot: a theme without own fonts
        // renders exactly the tree (and the useId values) it rendered before fonts.
        children
      )}
    </div>
  );
}
