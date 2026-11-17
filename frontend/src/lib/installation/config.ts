import { z } from 'zod';

// The API still sends `themeId` (older images read it); this image's theme is fixed
// at build time (themes/built-theme.ts), so the key is ignored and stripped here.
export const installationSchema = z.object({
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  fontPreset: z.enum(['default', 'system']),
  features: z.object({ reviews: z.boolean() }),
});
export type PublicInstallation = z.infer<typeof installationSchema>;
