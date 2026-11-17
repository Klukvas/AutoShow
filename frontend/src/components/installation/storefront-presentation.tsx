import type { PublicInstallation } from '@/lib/installation/config';
import { builtThemeId } from '@/themes/built-theme';

/**
 * Presentation markers for the public subtree. The theme is the one this image was
 * built with; the font preset is still runtime installation config.
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
      {children}
    </div>
  );
}
