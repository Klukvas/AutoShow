import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import type { StorefrontFont, StorefrontTheme } from '../../config/env.validation';

export type InstallationFeatures = Readonly<{ reviews: boolean }>;
export type FeatureName = keyof InstallationFeatures;
export type PublicInstallation = Readonly<{
  installationId: string;
  themeId: StorefrontTheme;
  fontPreset: StorefrontFont;
  features: InstallationFeatures;
}>;

@Injectable()
export class InstallationService {
  readonly publicConfig: PublicInstallation;
  readonly version: string;

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    this.publicConfig = Object.freeze({
      installationId: config.INSTALLATION_ID,
      themeId: config.STOREFRONT_THEME,
      fontPreset: config.STOREFRONT_FONT_PRESET,
      features: Object.freeze({ reviews: config.FEATURE_REVIEWS }),
    });
    this.version = config.APP_VERSION;
  }

  isEnabled(feature: FeatureName): boolean {
    return this.publicConfig.features[feature];
  }
}
