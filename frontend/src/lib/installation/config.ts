import { z } from 'zod';

export const installationSchema = z.object({
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  themeId: z.enum(['current', 'compact']),
  fontPreset: z.enum(['default', 'system']),
  features: z.object({ reviews: z.boolean() }),
});
export type PublicInstallation = z.infer<typeof installationSchema>;
