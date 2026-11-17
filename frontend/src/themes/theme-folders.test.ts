import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  THEME_ID_FORMAT,
  clientSlots,
  slotModules,
  themeFontsModule,
  themeIdModule,
  themeTokensStylesheet,
} from './contract';
import {
  computedImportStartsOf,
  contextDirectoriesOf,
  forwardedExportsOf,
  importsOf,
  instantiatesWithTypeOf,
  isClientModule,
  namesInCode,
  readsAsValue,
  usesFetch,
} from './source-scan';
import { readStylesheet } from './stylesheet-scan';
import {
  customPropertiesOf,
  sharedRulesThatBeatAThemeRule,
  sharedTokensOf,
  themeStylesheetProblems,
  tokenRulesOf,
  tokenStylesheetProblems,
} from './token-guards';

const themesDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(themesDir, '..');

const themeFolders = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const slotFiles = Object.values(slotModules);
const themeModules = [...slotFiles, themeIdModule, themeFontsModule];
// What app code may import from the built theme, besides its slots.
const themeFontsImport = `@theme/${themeFontsModule}`;
const themeTokensImport = `@theme/${themeTokensStylesheet}`;
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
const tokensFileOf = (folder: string) => join(themesDir, folder, themeTokensStylesheet);

// The stylesheets whose custom properties are the shared token contract.
const sharedStylesheets = ['styles/globals.css', 'styles/cinematic.css'].map((path) =>
  readStylesheet(join(srcDir, path)),
);
const sharedTokens = sharedTokensOf(sharedStylesheets);
const sharedTokenRules = tokenRulesOf(sharedStylesheets);
// The font variables: what the runtime font preset sets, and what fonts.ts sets per theme.
const fontVariables = customPropertiesOf([
  readStylesheet(join(srcDir, 'styles/installations.css')),
]);

// The files through which a build evaluates built-theme.ts, and with it the mismatch check.
const filesThatCheckTheBuiltTheme = [
  'app/health/frontend/route.ts',
  'components/installation/storefront-presentation.tsx',
];

describe('storefront theme folders', () => {
  it.each(themeFolders)('%s is a name the release workflow accepts', (folder) => {
    expect(folder).toMatch(THEME_ID_FORMAT);
  });

  it.each(themeFolders)(
    '%s has exactly the slot modules of the contract, id.ts, fonts.ts and index.ts',
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

  // The public layout imports `@theme/tokens.css`: a folder without it fails its own build,
  // but only when that theme is built — this fails for every folder at once.
  it.each(themeFolders)('%s has a tokens.css', (folder) => {
    expect(existsSync(tokensFileOf(folder))).toBe(true);
  });

  // token-guards.ts says what each rule is for, and token-guards.test.ts shows it
  // rejecting what the folders, whose tokens.css may hold no rule at all, never contain.
  it.each(themeFolders)(
    "%s/tokens.css sets shared tokens, validly, on its own theme's storefront only",
    (folder) => {
      const problems = tokenStylesheetProblems(
        readStylesheet(tokensFileOf(folder)),
        folder,
        sharedTokens,
      );
      expect(problems).toEqual([]);
    },
  );

  it.each(themeFolders)(
    '%s sets no shared token or font variable, and registers no property, in another stylesheet',
    (folder) => {
      const reserved = [...sharedTokens.keys(), ...fontVariables];
      const problems = stylesheetsUnder(join(themesDir, folder))
        .filter((file) => file !== tokensFileOf(folder))
        .flatMap((file) =>
          themeStylesheetProblems(readStylesheet(file), reserved).map(
            (problem) => `${display(file)}: ${problem}`,
          ),
        );
      expect(problems).toEqual([]);
    },
  );

  it('reads the shared tokens, their rules and the font variables from the shared stylesheets', () => {
    expect([...sharedTokens.keys()]).toEqual(
      expect.arrayContaining(['--bg', '--ink', '--accent', '--radius-card', '--shadow']),
    );
    expect(sharedTokenRules.flatMap((rule) => rule.selectors)).toEqual(
      expect.arrayContaining(['.platform-cinematic', "[data-theme='light'] .platform-cinematic"]),
    );
    expect(sorted(fontVariables)).toEqual(['--font-display', '--font-sans']);
  });

  // A shape nobody recognised would let any value through for that token.
  it('knows the shape of every shared token', () => {
    const unknown = [...sharedTokens].filter(([, shapes]) => shapes.includes('other'));
    expect(unknown).toEqual([]);
  });

  // What lets a theme write one rule for both colour modes (token-guards.ts).
  it('lets no shared rule that declares a token beat a theme rule, by weight or !important', () => {
    expect(sharedRulesThatBeatAThemeRule(sharedTokenRules)).toEqual([]);
  });

  // A stylesheet import is no TS import: `@import` of a theme's stylesheet from a shared
  // one would put that theme's CSS into every image, on every page.
  it('lets no stylesheet outside a theme folder @import a stylesheet of a theme', () => {
    const violations = stylesheetsUnder(srcDir)
      .filter((file) => !themeFolders.some((folder) => isInside(file, join(themesDir, folder))))
      .flatMap((file) =>
        stylesheetImportsOf(file)
          .filter((imported) => isInside(imported, themesDir))
          .map((imported) => `${display(file)} -> ${display(imported)}`),
      );
    expect(violations).toEqual([]);
  });

  // A theme's tokens and fonts reach the page through one import each. A second
  // importer — the admin layout, say — would carry them out of the storefront.
  it.each([
    [themeTokensImport, 'app/(public)/layout.tsx'],
    [themeFontsImport, 'components/installation/storefront-presentation.tsx'],
  ])('%s is imported by %s, statically, and by nothing else', (specifier, path) => {
    const importsIt = (
      isWanted: (imported: { isStatic: boolean; isTypeOnly: boolean }) => boolean,
    ) =>
      allSourceFiles
        .filter((file) =>
          importsOf(file).some(
            (imported) => asAliasPath(file, imported.specifier) === specifier && isWanted(imported),
          ),
        )
        .map(display);
    expect(importsIt(() => true)).toEqual([path]);
    expect(importsIt(({ isStatic, isTypeOnly }) => isStatic && !isTypeOnly)).toEqual([path]);
  });

  // As with builtThemeId below: an import whose binding nothing reads is dropped, and
  // the storefront would render without the theme's fonts while every other guard passes.
  it('reads the fonts of the built theme as a value in StorefrontPresentation', () => {
    const presentation = join(srcDir, 'components/installation/storefront-presentation.tsx');
    expect(readsAsValue(presentation, 'fonts')).toBe(true);
  });

  // The app only type-checks the fonts of the theme `@theme` points at for tsc (current):
  // each folder's index.ts is what puts its own fonts module under the contract.
  it.each(themeFolders)('%s/index.ts type-checks its fonts module', (folder) => {
    const index = join(themesDir, folder, 'index.ts');
    const importsFonts = importsOf(index).some(
      ({ specifier }) => specifier === `./${themeFontsModule}`,
    );
    expect(importsFonts && instantiatesWithTypeOf(index, 'ThemeFontsOf', 'fonts')).toBe(true);
  });

  // next/font puts the files of every font it is called for into the image, and the
  // root layout's fonts onto every page: a font loaded anywhere else would ship to
  // every client, or to the admin area.
  it('loads fonts with next/font only in lib/fonts.ts and the fonts.ts of a theme', () => {
    const allowed = new Set([
      join(srcDir, 'lib/fonts.ts'),
      ...themeFolders.flatMap((folder) => slotFileOf(folder, themeFontsModule) ?? []),
    ]);
    const violations = allSourceFiles
      .filter((file) => !allowed.has(file))
      .filter((file) =>
        importsOf(file).some(({ specifier }) => isOrIsUnder(specifier, 'next/font')),
      )
      .map((file) => `${display(file)} imports next/font`);
    expect(violations).toEqual([]);
  });

  // Any other stylesheet has to be imported by something in its folder for the same
  // reason; tokens.css is imported by the public layout instead.
  it.each(themeFolders)('%s has no stylesheet that nothing in the folder imports', (folder) => {
    const dir = join(themesDir, folder);
    const imported = new Set([
      ...sourceFilesUnder(dir).flatMap((file) =>
        importsOf(file).flatMap(({ specifier }) => pathOf(file, specifier) ?? []),
      ),
      ...stylesheetsUnder(dir).flatMap(stylesheetImportsOf),
    ]);
    const violations = stylesheetsUnder(dir).filter(
      (file) => file !== tokensFileOf(folder) && !imported.has(file),
    );
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

  it('lets app code reach a theme only through @theme/<slot>, its fonts and tokens.css', () => {
    const allowed = new Set([
      ...slotFiles.map((file) => `@theme/${file}`),
      themeFontsImport,
      themeTokensImport,
    ]);
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
