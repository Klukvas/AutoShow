import { describe, expect, it } from 'vitest';
import { parseStylesheet } from './stylesheet-scan';
import {
  customPropertiesOf,
  shapeOf,
  sharedRulesThatBeatAThemeRule,
  sharedTokensOf,
  targetsStorefrontOf,
  themeStylesheetProblems,
  tokenRulesOf,
  tokenStylesheetProblems,
} from './token-guards';

const parse = (css: string) => parseStylesheet(css, 'sheet.css');

// A small stand-in for globals.css and cinematic.css, with every shape they use.
const sharedStylesheets = [
  parse(`
    :root, [data-theme='light'] {
      --bg: 245 245 242; --ink: 20 22 27; --ink-2: 86 91 103; --line: 236 236 230;
      --accent: 46 83 230; --radius-card: 14px; --hairline-light: rgba(20, 16, 8, 0.12);
    }
    @media (prefers-contrast: more) { :root { --line: var(--ink-2); } }
    body { color: rgb(var(--ink)); }
  `),
  parse(`
    .platform-cinematic { --bg: 11 18 23; --radius-card: 0px; --hairline-light: rgba(255,255,255,.12); }
    [data-theme='light'] .platform-cinematic { --bg: 244 245 243; }
  `),
];
const shared = sharedTokensOf(sharedStylesheets);
const SCOPE = ":root body:has([data-storefront-theme='acme'])";
const LIGHT = ":root[data-theme='light'] body:has([data-storefront-theme='acme'])";
const problemsOf = (css: string) => tokenStylesheetProblems(parse(css), 'acme', shared);

describe('token shapes', () => {
  it.each([
    ['245 245 242', 'channels'],
    ['0 0 0', 'channels'],
    ['300 0 0', 'other'],
    ['1 2', 'other'],
    ['1, 2, 3', 'other'],
    ['#ff0000', 'other'],
    ['red', 'other'],
    ['14px', 'length'],
    ['0', 'length'],
    ['1.5rem', 'length'],
    ['.5em', 'length'],
    ['14', 'other'],
    ['calc(1px + 2px)', 'other'],
    ['rgba(255, 255, 255, 0.08)', 'colour'],
    ['rgba(255,255,255,.12)', 'colour'],
    ['rgb(0 0 0 / 50%)', 'colour'],
    ['hsl(210deg 40% 20%)', 'colour'],
    ['hsla(210, 40%, 20%, .5)', 'colour'],
    ['rgb(,,,)', 'other'],
    ['hsl(/)', 'other'],
    ['rgb(1 2)', 'other'],
    ['rgb(1, 2 3)', 'other'],
    ['url(https://example.com/x)', 'other'],
  ] as const)('%s is %s', (value, shape) => {
    expect(shapeOf(value)).toBe(shape);
  });
});

describe('shared tokens', () => {
  it('collects every token with the shapes the shared stylesheets give it', () => {
    expect([...shared.keys()]).toEqual([
      '--bg',
      '--ink',
      '--ink-2',
      '--line',
      '--accent',
      '--radius-card',
      '--hairline-light',
    ]);
    expect([...new Set(shared.get('--bg'))]).toEqual(['channels']);
    expect([...new Set(shared.get('--radius-card'))]).toEqual(['length']);
    expect([...new Set(shared.get('--hairline-light'))]).toEqual(['colour']);
    // `--line: var(--ink-2)` says nothing about the shape of --line.
    expect(shared.get('--line')).toEqual(['channels']);
  });

  it('keeps only the rules that declare tokens, with those declarations', () => {
    expect(tokenRulesOf(sharedStylesheets).map(({ selectors }) => selectors.join(', '))).toEqual([
      ":root, [data-theme='light']",
      ':root',
      '.platform-cinematic',
      "[data-theme='light'] .platform-cinematic",
    ]);
  });

  it('lists the custom properties of a stylesheet once each', () => {
    const preset = parse(
      '[data-font=system] { --font-sans: Arial; --font-display: Arial; font-family: var(--font-sans) } .x { --font-sans: serif }',
    );
    expect(customPropertiesOf([preset])).toEqual(['--font-sans', '--font-display']);
  });
});

describe('storefront scope of a selector', () => {
  it.each([
    ":root body:has([data-storefront-theme='acme'])",
    ':root body:has([data-storefront-theme="acme"])',
    ":root[data-theme='light'] body:has([data-storefront-theme='acme'])",
    ':root[data-theme="dark"]\n  body:has([data-storefront-theme="acme"]) .homepage-cinematic > footer',
  ])('takes %s for the storefront of acme', (selector) => {
    expect(targetsStorefrontOf('acme', selector)).toBe(true);
  });

  it.each([
    ':root',
    'body',
    '.platform-cinematic',
    "[data-storefront-theme='acme']",
    // Without `:root` it loses to the shared light tokens (contract.ts `storefrontScope`).
    "body:has([data-storefront-theme='acme'])",
    "[data-theme='light'] body:has([data-storefront-theme='acme'])",
    ":root body:has([data-storefront-theme='other'])",
    ":root body:has([data-storefront-theme='acme']).cinematic-admin",
    ":root[data-theme='dim'] body:has([data-storefront-theme='acme'])",
    // Reads like the scope once its quotes are unified, but the attribute value runs up
    // to the second double quote, so `:has()` also takes `*`: it matches every `<body>`.
    ':root body:has([data-storefront-theme="acme\']) "], *)',
    'body:has([data-storefront-theme="acme\']) "], *)',
  ])('does not take %s for the storefront of acme', (selector) => {
    expect(targetsStorefrontOf('acme', selector)).toBe(false);
  });
});

describe('problems of a tokens.css', () => {
  it.each([
    '',
    '/* No token overrides. */',
    `${SCOPE} { --bg: 38 12 64; --radius-card: 28px; --hairline-light: rgba(0, 0, 0, 0.2) }`,
    `${SCOPE} { --bg: 38 12 64; } ${LIGHT} { --bg: 255 244 214; }`,
    `${SCOPE} .homepage-cinematic { --line: var(--ink-2); --radius-card: 1.5rem; }`,
    `@media (prefers-contrast: more) { @supports (color: red) { ${SCOPE} { --line: 255 255 0; } } }`,
  ])('finds none in %j', (css) => {
    expect(problemsOf(css)).toEqual([]);
  });

  it.each([
    [':root { --bg: 1 2 3; }', [':root is not the storefront of acme']],
    [
      `${SCOPE}, .cinematic-admin { --bg: 1 2 3; }`,
      ['.cinematic-admin is not the storefront of acme'],
    ],
    [`${SCOPE} { --surfce: 1 2 3; }`, ['--surfce is not a token of the shared stylesheets']],
    [`${SCOPE} { --font-sans: Arial; }`, ['--font-sans is not a token of the shared stylesheets']],
    [`${SCOPE} { color: red; }`, ['color is not a token of the shared stylesheets']],
    [`${SCOPE} { --bg: #f00; }`, ['--bg: #f00 is not channels']],
    [`${SCOPE} { --bg: 300 0 0; }`, ['--bg: 300 0 0 is not channels']],
    [`${SCOPE} { --bg: 8px; }`, ['--bg: 8px is not channels']],
    [`${SCOPE} { --bg: rgb(1 2 3); }`, ['--bg: rgb(1 2 3) is not channels']],
    [`${SCOPE} { --bg: var(--radius-card); }`, ['--bg: var(--radius-card) is not channels']],
    [`${SCOPE} { --bg: var(--unknown); }`, ['--bg: var(--unknown) is not channels']],
    [`${SCOPE} { --radius-card: red; }`, ['--radius-card: red is not length']],
    [`${SCOPE} { --radius-card: 1 2 3; }`, ['--radius-card: 1 2 3 is not length']],
    [
      `${SCOPE} { --hairline-light: url(https://example.com/x); }`,
      ['--hairline-light: url(https://example.com/x) is not colour'],
    ],
    [`${SCOPE} { --hairline-light: rgb(,,,); }`, ['--hairline-light: rgb(,,,) is not colour']],
    [`${SCOPE} { --hairline-light: 1 2 3; }`, ['--hairline-light: 1 2 3 is not colour']],
    [`${SCOPE} { --bg: 1 2 3 !important; }`, ['--bg is !important']],
    [`${SCOPE} { --bg: var(--bg); }`, ['--bg reads itself']],
    [
      `${SCOPE} { --line: var(--ink-2); } ${LIGHT} { --ink-2: var(--line); }`,
      ['--line reads itself', '--ink-2 reads itself'],
    ],
    ['--bg: 1 2 3;', ['--bg: 1 2 3 is outside any rule']],
    [
      `@media (min-width: 1px) { --bg: 1 2 3; ${SCOPE} { --ink: 4 5 6 } }`,
      ['--bg: 1 2 3 is outside any rule'],
    ],
    ["@import './theme.css';", ['@import is not allowed']],
    [`@layer theme { ${SCOPE} { --bg: 1 2 3; } }`, ['@layer is not allowed']],
  ] as const)('finds them in %j', (css, problems) => {
    expect(problemsOf(css)).toEqual(problems);
  });

  it('refuses @property, with what it declares', () => {
    expect(
      problemsOf("@property --bg { syntax: '<color>'; inherits: true; initial-value: red; }"),
    ).toEqual(
      expect.arrayContaining([
        '@property is not allowed',
        'syntax is not a token of the shared stylesheets',
      ]),
    );
  });
});

describe('problems of another stylesheet of a theme', () => {
  const reserved = [...shared.keys(), '--font-sans', '--font-display'];
  const otherProblemsOf = (css: string) => themeStylesheetProblems(parse(css), reserved);

  it.each([
    '',
    "[data-storefront-theme='acme'] .home-section { padding-top: 40px; --acme-gap: 16px; }",
    '.acme-hero { color: rgb(var(--ink)); border-radius: var(--radius-card); font-family: var(--font-sans); }',
    '@media (min-width: 1px) { @keyframes acme-in { from { opacity: 0 } to { opacity: 1 } } }',
  ])('finds none in %j', (css) => {
    expect(otherProblemsOf(css)).toEqual([]);
  });

  it.each([
    [':root { --bg: 255 0 0; }', ['--bg is set outside tokens.css and fonts.ts']],
    [
      "[data-storefront-theme='acme'] .home-section { --radius-card: 2px; }",
      ['--radius-card is set outside tokens.css and fonts.ts'],
    ],
    [':root { --font-sans: Arial; }', ['--font-sans is set outside tokens.css and fonts.ts']],
    [
      `${SCOPE} { --font-display: Georgia; }`,
      ['--font-display is set outside tokens.css and fonts.ts'],
    ],
    [
      "@property --bg { syntax: '<color>'; inherits: true; initial-value: red; }",
      ['@property is not allowed'],
    ],
    [
      "@property --acme-gap { syntax: '<length>'; inherits: false; initial-value: 0px; }",
      ['@property is not allowed'],
    ],
  ] as const)('finds them in %j', (css, problems) => {
    expect(otherProblemsOf(css)).toEqual(problems);
  });
});

describe('shared rules against a theme rule', () => {
  const beating = (css: string) => sharedRulesThatBeatAThemeRule(tokenRulesOf([parse(css)]));

  it('lets the shared stylesheets as they are lose to the bare scope', () => {
    expect(sharedRulesThatBeatAThemeRule(tokenRulesOf(sharedStylesheets))).toEqual([]);
  });

  it.each([
    [
      "[data-theme='light'] body.platform-cinematic { --bg: 1 2 3; }",
      ["[data-theme='light'] body.platform-cinematic weighs as much as a theme rule"],
    ],
    ['#app { --bg: 1 2 3; }', ['#app weighs as much as a theme rule']],
    [
      '.platform-cinematic { --bg: 1 2 3 !important; }',
      ['.platform-cinematic sets --bg !important'],
    ],
  ] as const)('reports %j', (css, problems) => {
    expect(beating(css)).toEqual(problems);
  });

  it('ignores a heavy rule that declares no token', () => {
    expect(beating('#app .a .b .c { color: red !important; }')).toEqual([]);
  });
});
