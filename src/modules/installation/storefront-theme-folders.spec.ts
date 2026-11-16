import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { StorefrontTheme } from '../../config/env.validation';

// The frontend image is built from ./frontend alone, so the two packages cannot
// share a source file; this check is what keeps their theme ids in sync.
const frontendThemesDir = join(__dirname, '../../../frontend/src/themes');

describe('StorefrontTheme enum', () => {
  it('equals the sub-folders of frontend/src/themes, because every sub-folder there is a theme (rule: frontend/src/themes/ids.ts)', () => {
    const themeFolders = readdirSync(frontendThemesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect([...Object.values(StorefrontTheme)].sort()).toEqual([...themeFolders].sort());
  });
});
