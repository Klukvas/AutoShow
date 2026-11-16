import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { installationSchema } from '@/lib/installation/config';
import { CinematicInventoryCard } from './current/inventory-card';
import { DetailedInventoryCard } from './compact/inventory-card';
import { getTheme, themes } from './registry';

const themesDir = fileURLToPath(new URL('.', import.meta.url));

const themeFolders = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const sorted = (ids: readonly string[]) => [...ids].sort();
const withoutBlockComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

describe('storefront themes', () => {
  it('keeps theme folders, registry entries and accepted installation ids identical', () => {
    expect(sorted(Object.keys(themes))).toEqual(sorted(themeFolders));
    expect(sorted(installationSchema.shape.themeId.options)).toEqual(sorted(themeFolders));
  });

  it('keeps the approved current card and lets compact replace only the inventory card', () => {
    const current = getTheme('current');
    const compact = getTheme('compact');
    expect(current.InventoryCard).toBe(CinematicInventoryCard);
    expect(compact.InventoryCard).toBe(DetailedInventoryCard);
    expect(compact.Home).toBe(current.Home);
  });

  it('lists exactly the existing theme.css files in the styles aggregator', () => {
    const aggregatorSource = withoutBlockComments(
      readFileSync(join(themesDir, 'styles.ts'), 'utf8'),
    );
    const importedStyles = [...aggregatorSource.matchAll(/^import '\.\/(.+)';$/gm)].map(
      (match) => match[1],
    );
    const existingStyles = themeFolders
      .map((folder) => `${folder}/theme.css`)
      .filter((stylePath) => existsSync(join(themesDir, stylePath)));
    expect(sorted(importedStyles)).toEqual(sorted(existingStyles));
  });

  it('imports the styles aggregator from the public layout', () => {
    const layoutSource = withoutBlockComments(
      readFileSync(join(themesDir, '../app/(public)/layout.tsx'), 'utf8'),
    );
    expect(layoutSource).toMatch(/^import '@\/themes\/styles';$/m);
  });
});
