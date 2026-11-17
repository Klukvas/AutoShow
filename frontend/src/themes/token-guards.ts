// Test support for theme-folders.test.ts: the rules a theme's stylesheets must keep so
// that its tokens work, and only on its own storefront. Pure functions over parsed
// stylesheets, tested on their own in token-guards.test.ts — the theme folders only hold
// stylesheets that pass. Never imported by app code, so it is in no bundle.
import { storefrontScope } from './contract';
import {
  compareSpecificity,
  specificityOf,
  type Declaration,
  type StyleRule,
  type Stylesheet,
} from './stylesheet-scan';

/**
 * What a token's value is, as far as its readers care: `rgb(var(--bg) / 0.5)` needs
 * three channels, `border-radius: var(--radius-card)` a length, `border: 1px solid
 * var(--hairline-light)` a whole colour.
 */
export type TokenShape = 'channels' | 'length' | 'colour' | 'other';

const NUMBER = String.raw`\d*\.?\d+%?`;
const FIRST_NUMBER = String.raw`\d*\.?\d+(?:%|deg)?`;
// rgb()/hsl() with three real components and an optional alpha, commas or spaces.
const COLOUR_FUNCTION = new RegExp(
  String.raw`^(?:rgb|hsl)a?\(\s*${FIRST_NUMBER}` +
    String.raw`(?:(?:\s*,\s*${NUMBER}){2}(?:\s*,\s*${NUMBER})?|(?:\s+${NUMBER}){2}(?:\s*/\s*${NUMBER})?)\s*\)$`,
);

export function shapeOf(value: string): TokenShape {
  const isChannels =
    /^\d{1,3}( \d{1,3}){2}$/.test(value) && value.split(' ').every((part) => Number(part) <= 255);
  if (isChannels) return 'channels';
  if (/^(0|\d*\.?\d+(px|rem|em))$/.test(value)) return 'length';
  return COLOUR_FUNCTION.test(value) ? 'colour' : 'other';
}

/** The tokens a value reads: every `var(--name)` in it. */
const referencesIn = (value: string) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);
const isOneReference = (value: string) => /^var\(\s*--[\w-]+\s*\)$/.test(value);
const isCustomProperty = ({ property }: Declaration) => property.startsWith('--');

/** The shared tokens, each with the shapes the shared stylesheets give it. */
export type SharedTokens = ReadonlyMap<string, readonly TokenShape[]>;

/** The rules of the shared stylesheets that declare tokens, with those declarations only. */
export function tokenRulesOf(stylesheets: readonly Stylesheet[]): readonly StyleRule[] {
  return stylesheets
    .flatMap(({ rules }) => rules)
    .map((rule) => ({ ...rule, declarations: rule.declarations.filter(isCustomProperty) }))
    .filter((rule) => rule.declarations.length > 0);
}

/** A `var(--other)` in a shared stylesheet says nothing about the shape, and is skipped. */
export function sharedTokensOf(stylesheets: readonly Stylesheet[]): SharedTokens {
  return tokenRulesOf(stylesheets)
    .flatMap(({ declarations }) => declarations)
    .filter(({ value }) => !isOneReference(value))
    .reduce(
      (shapes, { property, value }) =>
        new Map(shapes).set(property, [...(shapes.get(property) ?? []), shapeOf(value)]),
      new Map<string, readonly TokenShape[]>(),
    );
}

/** The custom properties some stylesheets declare, e.g. the font variables of a preset. */
export const customPropertiesOf = (stylesheets: readonly Stylesheet[]): readonly string[] => [
  ...new Set(
    stylesheets.flatMap(({ declarations }) =>
      declarations.filter(isCustomProperty).map(({ property }) => property),
    ),
  ),
];

/** The shapes a value can take: its own, or those of the shared token it refers to. */
function shapesOf(value: string, shared: SharedTokens): readonly TokenShape[] {
  const [referenced] = isOneReference(value) ? referencesIn(value) : [];
  return referenced ? (shared.get(referenced) ?? ['other']) : [shapeOf(value)];
}

/**
 * The tokens that read themselves, directly (`--bg: var(--bg)`) or round a loop
 * (`--a: var(--b)` with `--b: var(--a)`): the browser makes every one invalid. Rules are
 * not told apart: a loop that only closes across two colour modes is refused as well,
 * which costs a theme nothing.
 */
function tokensInAReferenceCycle(declarations: readonly Declaration[]): readonly string[] {
  const readBy = (property: string) =>
    declarations
      .filter((declaration) => declaration.property === property)
      .flatMap(({ value }) => referencesIn(value));
  const reaches = (from: string, target: string, seen: readonly string[]): boolean =>
    readBy(from).some(
      (next) => next === target || (!seen.includes(next) && reaches(next, target, [...seen, next])),
    );
  return [...new Set(declarations.map(({ property }) => property))].filter((property) =>
    reaches(property, property, [property]),
  );
}

// The scope of a theme in both colour modes and in each one, quoted either way. Built
// from the contract and compared as text: rewriting quotes in the selector under test
// would let one that only looks like the scope through.
const colourScopes = [undefined, 'light', 'dark'] as const;
const scopeSpellingsOf = (themeId: string) =>
  colourScopes
    .map((mode) => storefrontScope(themeId, mode))
    .flatMap((scope) => [scope, scope.replaceAll("'", '"')]);

/**
 * Whether a selector is the storefront of this theme, optionally in one colour mode and
 * narrowed to something inside the storefront. contract.ts (`storefrontScope`) says why
 * `<body>` and why `:root`: a bare `:root`, `body` or class would also restyle the admin
 * area, another theme's id would never match, the wrapper itself would miss the shared
 * tokens of `<body>` and everything portaled out of it.
 */
export function targetsStorefrontOf(themeId: string, selector: string): boolean {
  const target = selector.trim().replace(/\s+/g, ' ');
  return scopeSpellingsOf(themeId).some(
    (scope) => target === scope || target.startsWith(`${scope} `),
  );
}

// A condition around token rules (contrast, width) is fine. `@import` would pull in a
// stylesheet these guards never read, `@layer` would lose to the unlayered shared
// tokens, `@property` would register the token for every page, the admin area included.
const TOKEN_AT_RULES = ['media', 'supports'];

function tokenProblem({ property, value, isImportant }: Declaration, shared: SharedTokens) {
  const shapes = shared.get(property);
  // A misspelt token is a custom property nothing reads: the override silently does
  // nothing. Fonts are not tokens: `--font-*` come from fonts.ts, through next/font.
  if (!shapes) return [`${property} is not a token of the shared stylesheets`];
  // The shared rules win or lose by weight alone; `!important` would also beat the
  // dealer's accent in a way no later rule of the theme could take back.
  if (isImportant) return [`${property} is !important`];
  // `--bg: #f00` is a valid custom property and an invalid colour wherever it is read.
  return shapesOf(value, shared).every((shape) => shapes.includes(shape))
    ? []
    : [`${property}: ${value} is not ${[...new Set(shapes)].join(' or ')}`];
}

/** What is wrong with a theme's tokens.css; nothing when it keeps every rule. */
export function tokenStylesheetProblems(
  stylesheet: Stylesheet,
  themeId: string,
  shared: SharedTokens,
): readonly string[] {
  return [
    ...stylesheet.atRules
      .filter((name) => !TOKEN_AT_RULES.includes(name))
      .map((name) => `@${name} is not allowed`),
    ...stylesheet.rules
      .flatMap(({ selectors }) => selectors)
      .filter((selector) => !targetsStorefrontOf(themeId, selector))
      .map((selector) => `${selector} is not the storefront of ${themeId}`),
    // The parser accepts `--bg: 1 2 3;` outside a rule; the browser drops it.
    ...stylesheet.declarationsOutsideRules.map(
      ({ property, value }) => `${property}: ${value} is outside any rule`,
    ),
    ...stylesheet.declarations.flatMap((declaration) => tokenProblem(declaration, shared)),
    ...tokensInAReferenceCycle(stylesheet.declarations).map(
      (property) => `${property} reads itself`,
    ),
  ];
}

/**
 * What is wrong with any other stylesheet of a theme. tokens.css is where the token
 * guards look, so a token (or a font variable, which belongs to fonts.ts) set elsewhere
 * would escape all of them — and on any selector: Next keeps a route's CSS loaded after
 * a soft navigation, so `:root { --bg: … }` in theme.css would follow the visitor into
 * the admin area. `@property` registers a custom property for the whole document.
 */
export function themeStylesheetProblems(
  stylesheet: Stylesheet,
  reservedProperties: readonly string[],
): readonly string[] {
  return [
    ...stylesheet.atRules
      .filter((name) => name === 'property')
      .map(() => '@property is not allowed'),
    ...stylesheet.declarations
      .filter(({ property }) => reservedProperties.includes(property))
      .map(({ property }) => `${property} is set outside tokens.css and fonts.ts`),
  ];
}

/**
 * What would let a shared rule beat a theme's token rule. The shared stylesheets
 * re-declare tokens for light mode on `<body>`, and a theme rule that weighed less would
 * win in dark and silently lose in light; `!important` beats any weight. Every selector
 * of a tokens.css starts with a scope and can only add to its weight, so the bare scope
 * is the weakest rule a theme can write.
 */
export function sharedRulesThatBeatAThemeRule(
  sharedTokenRules: readonly StyleRule[],
): readonly string[] {
  const weakestThemeRule = specificityOf(storefrontScope('acme'));
  return sharedTokenRules.flatMap(({ selectors, declarations }) => [
    ...selectors
      .filter((selector) => compareSpecificity(weakestThemeRule, specificityOf(selector)) <= 0)
      .map((selector) => `${selector} weighs as much as a theme rule`),
    ...declarations
      .filter(({ isImportant }) => isImportant)
      .map(({ property }) => `${selectors.join(', ')} sets ${property} !important`),
  ]);
}
