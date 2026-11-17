import type { ThemeFonts } from '../contract';

/** No own fonts: the storefront keeps the app fonts of src/lib/fonts.ts. */
export const fonts = { sans: null, display: null } as const satisfies ThemeFonts;
