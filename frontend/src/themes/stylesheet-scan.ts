// Test support for theme-folders.test.ts: what a stylesheet targets and declares, read
// from its syntax tree. Never imported by app code, so it is in no bundle.
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

export type Declaration = Readonly<{ property: string; value: string; isImportant: boolean }>;
/** One rule, selector list split: `a, b { --x: 1 }` has the selectors `a` and `b`. */
export type StyleRule = Readonly<{
  selectors: readonly string[];
  declarations: readonly Declaration[];
}>;
/** What a stylesheet targets and declares, at any nesting depth, in source order. */
export type Stylesheet = Readonly<{
  /** Every rule with its own declarations, also the rules inside at-rules. */
  rules: readonly StyleRule[];
  /** Every declaration, properties and custom properties (`--name`), wherever it stands. */
  declarations: readonly Declaration[];
  /** Declarations that stand outside any rule: valid to the parser, dropped by the browser. */
  declarationsOutsideRules: readonly Declaration[];
  /** The name of every at-rule: `media` for `@media (…) {}`, `import` for `@import`. */
  atRules: readonly string[];
}>;

/** A node and everything nested in it. */
const withDescendants = (node: postcss.ChildNode): readonly postcss.ChildNode[] => [
  node,
  ...('nodes' in node && node.nodes ? node.nodes.flatMap(withDescendants) : []),
];

// Trimmed: postcss keeps the space before `}` in the value of a custom property that
// has no closing semicolon.
const declarationOn = (node: postcss.ChildNode): readonly Declaration[] =>
  node.type === 'decl'
    ? [{ property: node.prop, value: node.value.trim(), isImportant: node.important === true }]
    : [];

/**
 * A rule nested in a rule is refused: its real selector is built from its parent's, so
 * reading it alone would report a selector (and a weight) the browser never uses.
 */
function ruleOn(node: postcss.ChildNode, name: string): readonly StyleRule[] {
  if (node.type !== 'rule') return [];
  if (node.parent?.type === 'rule') {
    throw new Error(`Nested rule ${node.selector} in ${name}: write the full selector`);
  }
  return [{ selectors: node.selectors, declarations: node.nodes.flatMap(declarationOn) }];
}

/** `name` is what an error calls the stylesheet. */
export function parseStylesheet(css: string, name: string): Stylesheet {
  const nodes = postcss.parse(css, { from: name }).nodes.flatMap(withDescendants);
  return {
    rules: nodes.flatMap((node) => ruleOn(node, name)),
    declarations: nodes.flatMap(declarationOn),
    declarationsOutsideRules: nodes.flatMap((node) =>
      node.parent?.type === 'rule' ? [] : declarationOn(node),
    ),
    atRules: nodes.flatMap((node) => (node.type === 'atrule' ? [node.name] : [])),
  };
}

export const readStylesheet = (file: string): Stylesheet =>
  parseStylesheet(readFileSync(file, 'utf8'), file);

/** Specificity as (ids, classes/attributes/pseudo-classes, types/pseudo-elements). */
export type Specificity = readonly [number, number, number];

const NONE: Specificity = [0, 0, 0];
const plus = (a: Specificity, b: Specificity): Specificity => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
/** Positive when `a` wins over `b`, 0 when source order decides. */
export const compareSpecificity = (a: Specificity, b: Specificity): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const strongest = (all: readonly Specificity[]): Specificity =>
  all.reduce((best, next) => (compareSpecificity(next, best) > 0 ? next : best), NONE);

// `:before` and its kin are pseudo-elements that may be written with one colon.
const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);
// Functional pseudo-classes that weigh as much as their strongest argument.
const WEIGHS_AS_ARGUMENT = new Set(['is', 'not', 'has']);

/** Index just past the `)` that closes the `(` at `open`. */
function endOfParentheses(selector: string, open: number): number {
  const depthAt = (index: number, depth: number): number => {
    if (index >= selector.length) return selector.length;
    const next = depth + (selector[index] === '(' ? 1 : selector[index] === ')' ? -1 : 0);
    return next === 0 ? index + 1 : depthAt(index + 1, next);
  };
  return depthAt(open, 0);
}

/**
 * The specificity of one complex selector, by the rules of Selectors Level 4 for what
 * the shared stylesheets and theme scopes use: ids, classes, attributes, types, `*`,
 * pseudo-classes and -elements, `:is()`/`:not()`/`:has()` (their strongest argument)
 * and `:where()` (nothing). Any other functional pseudo-class counts as one class.
 * What it cannot weigh correctly it refuses instead of returning a wrong number: a
 * selector list (each selector of `a, b` has its own weight), the nesting selector `&`
 * and `:nth-child(… of S)`, whose weight includes that of `S`.
 */
export function specificityOf(selector: string): Specificity {
  const token =
    /\[[^\]]*\]|#[\w-]+|\.[\w-]+|::[\w-]+|:([\w-]+)(\()?|(?<![\w-])[a-zA-Z][\w-]*|[\s>+~*]+/y;
  const weigh = (index: number, total: Specificity): Specificity => {
    if (index >= selector.length) return total;
    token.lastIndex = index;
    const match = token.exec(selector);
    if (!match) throw new Error(`Cannot weigh selector ${selector} at ${index}`);
    const [text, pseudoClass, opensArguments] = match;
    const end = token.lastIndex;
    if (text.startsWith('[') || text.startsWith('.')) return weigh(end, plus(total, [0, 1, 0]));
    if (text.startsWith('#')) return weigh(end, plus(total, [1, 0, 0]));
    if (text.startsWith('::')) return weigh(end, plus(total, [0, 0, 1]));
    if (pseudoClass === undefined) {
      return weigh(end, /^[a-zA-Z]/.test(text) ? plus(total, [0, 0, 1]) : total);
    }
    if (!opensArguments) {
      const isElement = LEGACY_PSEUDO_ELEMENTS.has(pseudoClass);
      return weigh(end, plus(total, isElement ? [0, 0, 1] : [0, 1, 0]));
    }
    const close = endOfParentheses(selector, end - 1);
    if (pseudoClass === 'where') return weigh(close, total);
    if (!WEIGHS_AS_ARGUMENT.has(pseudoClass)) {
      if (/\sof\s/.test(selector.slice(end, close - 1))) {
        throw new Error(`Cannot weigh selector ${selector}: :${pseudoClass}(… of S)`);
      }
      return weigh(close, plus(total, [0, 1, 0]));
    }
    const options = postcss.list.comma(selector.slice(end, close - 1)).map(specificityOf);
    return weigh(close, plus(total, strongest(options)));
  };
  return weigh(0, NONE);
}
