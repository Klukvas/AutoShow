import type { PublicInstallation } from '@/lib/installation/config';

/** Presentation selection is separate from fetching, permissions and car logic. */
export function StorefrontPresentation({
  installation,
  children,
}: {
  installation: PublicInstallation;
  children: React.ReactNode;
}) {
  return (
    <div
      data-storefront-theme={installation.themeId}
      data-storefront-font={installation.fontPreset}
    >
      {children}
    </div>
  );
}
