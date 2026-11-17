import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { clientSlots, slotModules, themeIdModule } from './contract';
import {
  computedImportStartsOf,
  contextDirectoriesOf,
  forwardedExportsOf,
  importsOf,
  isClientModule,
  namesInCode,
  readsAsValue,
  usesFetch,
} from './source-scan';

const themesDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(themesDir, '..');

const themeFolders = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// The format .github/workflows/release.yml accepts for STOREFRONT_THEME: a folder
// named otherwise could be built locally but never released.
const RELEASABLE_THEME_ID = /^[a-z][a-z0-9-]{0,62}$/;

const slotFiles = Object.values(slotModules);
const themeModules = [...slotFiles, themeIdModule];
const sorted = (values: readonly string[]) => [...values].sort();
const isSourceFile = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);

function filesUnder(dir: string, isWanted: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, isWanted);
    return isWanted(entry.name) ? [path] : [];
  });
}
const sourceFilesUnder = (dir: string) => filesUnder(dir, isSourceFile);
const stylesheetsUnder = (dir: string) => filesUnder(dir, (name) => name.endsWith('.css'));

/** A relative specifier as the `@/…` path it points at, so both spellings are checked. */
function asAliasPath(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  const target = relative(srcDir, resolve(dirname(file), specifier));
  return target.startsWith('..') ? specifier : `@/${target.split(sep).join('/')}`;
}

/** The file or directory a specifier names, for the spellings that stay inside `src/`. */
function pathOf(file: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier);
  return specifier === '@' || specifier.startsWith('@/')
    ? resolve(srcDir, specifier.slice(2))
    : undefined;
}

/** The source file a module specifier resolves to, if it is one of ours. */
function sourceFileOf(file: string, specifier: string): string | undefined {
  const path = pathOf(file, specifier);
  return path
    ? [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), join(path, 'index.tsx')].find(
        (candidate) => isSourceFile(candidate) && existsSync(candidate),
      )
    : undefined;
}

/** The files a stylesheet pulls in with `@import`. */
function stylesheetImportsOf(file: string): string[] {
  const imports = readFileSync(file, 'utf8').matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g);
  return [...imports].map(([, specifier]) => resolve(dirname(file), specifier));
}

/** The modules an export passes through: the file itself and everything it is re-exported from. */
function modulesBehind(file: string, exportName: string, seen: readonly string[] = []): string[] {
  if (seen.includes(file)) return [];
  return [
    file,
    ...forwardedExportsOf(file, exportName).flatMap(({ specifier, name }) => {
      const origin = sourceFileOf(file, specifier);
      return origin ? modulesBehind(origin, name, [...seen, file]) : [];
    }),
  ];
}

const isOrIsUnder = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
const isInside = (path: string, dir: string) => {
  const fromDir = relative(dir, path);
  return !fromDir.startsWith('..') && !isAbsolute(fromDir);
};
/** A webpack context over this directory would bundle theme files, whichever theme is built. */
function bundlesThemes(file: string, directory: string): boolean {
  if (isOrIsUnder(directory.replace(/\/+$/, ''), '@theme')) return true;
  const path = pathOf(file, directory);
  return path !== undefined && (isInside(path, themesDir) || isInside(themesDir, path));
}
const pointsIntoThemeFolder = (path: string) =>
  themeFolders.some((folder) => isOrIsUnder(path, `@/themes/${folder}`));
const display = (file: string) => relative(srcDir, file);

const appFiles = sourceFilesUnder(srcDir).filter((file) => !file.startsWith(themesDir));
const themeFiles = themeFolders.flatMap((folder) => sourceFilesUnder(join(themesDir, folder)));
const topLevelThemeFiles = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && isSourceFile(entry.name))
  .map((entry) => join(themesDir, entry.name));
const allSourceFiles = [...appFiles, ...topLevelThemeFiles, ...themeFiles];
const slotFileOf = (folder: string, module: string) =>
  ['.ts', '.tsx']
    .map((extension) => join(themesDir, folder, `${module}${extension}`))
    .find((file) => existsSync(file));
// The files through which a build evaluates built-theme.ts, and with it the mismatch check.
const filesThatCheckTheBuiltTheme = [
  'app/health/frontend/route.ts',
  'components/installation/storefront-presentation.tsx',
];

describe('storefront theme folders', () => {
  it.each(themeFolders)('%s is a name the release workflow accepts', (folder) => {
    expect(folder).toMatch(RELEASABLE_THEME_ID);
  });

  it.each(themeFolders)(
    '%s has exactly the slot modules of the contract, id.ts and index.ts',
    (folder) => {
      const modules = readdirSync(join(themesDir, folder), { withFileTypes: true })
        .filter((entry) => entry.isFile() && isSourceFile(entry.name))
        .map((entry) => basename(entry.name, extname(entry.name)));
      expect(sorted(modules)).toEqual(sorted([...themeModules, 'index']));
    },
  );

  it.each(themeFolders)('%s/id.ts names its own folder', async (folder) => {
    const { themeId } = (await import(`./${folder}/${themeIdModule}.ts`)) as { themeId: unknown };
    expect(themeId).toBe(folder);
  });

  it.each(themeFolders)('%s/index.ts assembles each slot from its own module', async (folder) => {
    const { theme } = (await import(`./${folder}/index.ts`)) as { theme: Record<string, unknown> };
    expect(sorted(Object.keys(theme))).toEqual(sorted(Object.keys(slotModules)));
    for (const [slot, file] of Object.entries(slotModules)) {
      const slotModule = (await import(`./${folder}/${file}`)) as Record<string, unknown>;
      expect(theme[slot]).toBe(slotModule[slot]);
    }
  });

  // The shell renders on every public page, so it is the module that must carry the CSS:
  // a theme.css nothing imports is silently left out of the image.
  it("wires a theme's theme.css through its shell module", () => {
    const violations = themeFolders
      .filter((folder) => existsSync(join(themesDir, folder, 'theme.css')))
      .filter((folder) => {
        const shell = slotFileOf(folder, slotModules.Shell);
        return !shell || !importsOf(shell).some(({ specifier }) => specifier === './theme.css');
      })
      .map((folder) => `${folder}/theme.css is not imported by ${folder}/${slotModules.Shell}`);
    expect(violations).toEqual([]);
  });

  // Any other stylesheet has to be imported by something in its folder for the same reason.
  it.each(themeFolders)('%s has no stylesheet that nothing in the folder imports', (folder) => {
    const dir = join(themesDir, folder);
    const imported = new Set([
      ...sourceFilesUnder(dir).flatMap((file) =>
        importsOf(file).flatMap(({ specifier }) => pathOf(file, specifier) ?? []),
      ),
      ...stylesheetsUnder(dir).flatMap(stylesheetImportsOf),
    ]);
    const violations = stylesheetsUnder(dir).filter((file) => !imported.has(file));
    expect(violations.map(display)).toEqual([]);
  });

  // contract.ts (`clientSlots`) says why. Beyond a syntactic check: a server slot that
  // hands its model on to a client component of its own — Next reports that on request.
  it.each(themeFolders)("%s keeps every server slot's module a server module", (folder) => {
    const clientSlotNames: readonly string[] = clientSlots;
    const violations = Object.entries(slotModules)
      .filter(([slot]) => !clientSlotNames.includes(slot))
      .flatMap(([slot, module]) => {
        const slotFile = slotFileOf(folder, module);
        return (slotFile ? modulesBehind(slotFile, slot) : [])
          .filter(isClientModule)
          .map((file) => `${slot}: ${display(file)} is a 'use client' module`);
      });
    expect(violations).toEqual([]);
  });

  // The mismatch check of built-theme.ts runs when that module is evaluated, and a build
  // evaluates only what its routes import: these two imports put the check into every build.
  it.each(filesThatCheckTheBuiltTheme)(
    '%s statically imports built-theme.ts, so every build checks its theme',
    (path) => {
      const file = join(srcDir, path);
      const evaluated = importsOf(file)
        .filter(({ isStatic, isTypeOnly }) => isStatic && !isTypeOnly)
        .map(({ specifier }) => asAliasPath(file, specifier));
      expect(evaluated).toContain('@/themes/built-theme');
    },
  );

  // The import alone does not hold: the compiler drops one whose binding nothing reads,
  // and neither tsc nor lint reports it here — built-theme.ts would silently stop being
  // evaluated through that file.
  it.each(filesThatCheckTheBuiltTheme)(
    '%s reads builtThemeId as a value, so the compiler keeps that import',
    (path) => {
      expect(readsAsValue(join(srcDir, path), 'builtThemeId')).toBe(true);
    },
  );

  // `builtThemeId` is the id the bundle was proven to contain; the variable is only what
  // was asked for, and reading it would bypass the mismatch check.
  it('reads the theme id from built-theme.ts, never from the environment variable', () => {
    const builtThemeModule = join(themesDir, 'built-theme.ts');
    const violations = allSourceFiles
      .filter((file) => file !== builtThemeModule && namesInCode(file, 'STOREFRONT_THEME'))
      .map((file) => `${display(file)} names STOREFRONT_THEME`);
    expect(violations).toEqual([]);
  });

  it('lets app code reach a theme only through @theme/<slot>, never a folder, index or id', () => {
    const allowed = new Set(slotFiles.map((file) => `@theme/${file}`));
    const violations = appFiles.flatMap((file) =>
      importsOf(file)
        .map(({ specifier }) => asAliasPath(file, specifier))
        .filter(
          (path) =>
            pointsIntoThemeFolder(path) || (isOrIsUnder(path, '@theme') && !allowed.has(path)),
        )
        .map((path) => `${display(file)} -> ${path}`),
    );
    expect(violations).toEqual([]);
  });

  it('keeps the files directly in themes/ theme-agnostic: @theme/<module>, never a folder', () => {
    const allowed = new Set(themeModules.map((file) => `@theme/${file}`));
    const violations = topLevelThemeFiles.flatMap((file) =>
      importsOf(file)
        .map(({ specifier }) => asAliasPath(file, specifier))
        .filter(
          (path) =>
            pointsIntoThemeFolder(path) || (isOrIsUnder(path, '@theme') && !allowed.has(path)),
        )
        .map((path) => `${display(file)} -> ${path}`),
    );
    expect(violations).toEqual([]);
  });

  it('lets themes reuse each other by relative path, not @theme (which is the built theme)', () => {
    const violations = themeFiles.flatMap((file) =>
      importsOf(file)
        .filter(({ specifier }) => isOrIsUnder(specifier, '@theme'))
        .map(({ specifier }) => `${display(file)} -> ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  // A computed specifier makes the bundler include every module it could match, i.e.
  // every theme, and picks one at run time — both defeat the build-time choice.
  it('never loads a theme through a computed import() or require()', () => {
    const violations = allSourceFiles.flatMap((file) =>
      computedImportStartsOf(file)
        .map((start) => asAliasPath(file, start))
        .filter((path) => isOrIsUnder(path, '@theme') || isOrIsUnder(path, '@/themes'))
        .map((path) => `${display(file)} -> computed import of ${path}…`),
    );
    expect(violations).toEqual([]);
  });

  // A context bundles a whole directory, with the same two effects.
  it('never bundles theme files through require.context() or import.meta.webpackContext()', () => {
    const violations = allSourceFiles.flatMap((file) =>
      contextDirectoriesOf(file)
        .filter((directory) => bundlesThemes(file, directory))
        .map((directory) => `${display(file)} -> context over ${directory}`),
    );
    expect(violations).toEqual([]);
  });

  // Known gaps, outside the theme folders: the shared components
  // components/home/stats-band.tsx (home and about views) and
  // components/listing/similar-cars.tsx (car page view) still fetch their own data.
  it('keeps data access out of themes: views render the model they are given', () => {
    const dataAccess = [
      '@/lib/api/',
      '@/lib/storefront/',
      '@/lib/installation/server',
      '@/lib/branding/resolve',
    ];
    const violations = themeFiles.flatMap((file) => [
      ...importsOf(file)
        .filter(({ isTypeOnly }) => !isTypeOnly)
        .map(({ specifier }) => asAliasPath(file, specifier))
        .filter((path) => dataAccess.some((prefix) => path.startsWith(prefix)))
        .map((path) => `${display(file)} -> ${path}`),
      ...(usesFetch(file) ? [`${display(file)} -> fetch`] : []),
    ]);
    expect(violations).toEqual([]);
  });
});
