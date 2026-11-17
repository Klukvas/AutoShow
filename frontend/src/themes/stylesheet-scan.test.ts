import { describe, expect, it } from 'vitest';
import { compareSpecificity, parseStylesheet, specificityOf } from './stylesheet-scan';

const parse = (css: string) => parseStylesheet(css, 'sheet.css');
const declaration = (property: string, value: string, isImportant = false) => ({
  property,
  value,
  isImportant,
});

describe('parsed stylesheet', () => {
  it('reads rules inside at-rules with their own declarations', () => {
    const { rules } = parse(
      'a, b { --x: 1 } @media (min-width: 1px) { c { color: red !important; --y: 2 } }',
    );
    expect(rules).toEqual([
      { selectors: ['a', 'b'], declarations: [declaration('--x', '1')] },
      {
        selectors: ['c'],
        declarations: [declaration('color', 'red', true), declaration('--y', '2')],
      },
    ]);
  });

  it('refuses a rule nested in a rule: its selector depends on its parent', () => {
    expect(() => parse('.a { --x: 1; .b { --y: 2 } }')).toThrow('Nested rule .b in sheet.css');
  });

  it('tells declarations that stand outside any rule from the rest', () => {
    const { declarations, declarationsOutsideRules } = parse(
      '--x: 1; a { --y: 2 } @media (min-width: 1px) { --z: 3; b { --w: 4 } }',
    );
    expect(declarations.map(({ property }) => property)).toEqual(['--x', '--y', '--z', '--w']);
    expect(declarationsOutsideRules).toEqual([declaration('--x', '1'), declaration('--z', '3')]);
  });

  it('names every at-rule, nested ones included', () => {
    const { atRules } = parse(
      "@import './a.css'; @media (min-width: 1px) { @supports (color: red) { a { --x: 1 } } } @property --x { inherits: true }",
    );
    expect(atRules).toEqual(['import', 'media', 'supports', 'property']);
  });
});

describe('selector specificity', () => {
  it.each([
    ['.platform-cinematic', [0, 1, 0]],
    ["[data-theme='light'] .platform-cinematic", [0, 2, 0]],
    ["body:has([data-storefront-theme='acme'])", [0, 1, 1]],
    [":root body:has([data-storefront-theme='acme'])", [0, 2, 1]],
    [
      ":root[data-theme='light'] body:has([data-storefront-theme='acme']) .zone > footer",
      [0, 4, 2],
    ],
    [':where(h1, h2, h3)', [0, 0, 0]],
    [':is(#hero, .card) p::after', [1, 0, 2]],
    ['a:not(.muted, [hidden]):hover', [0, 2, 1]],
    ['li:nth-child(2n + 1):before', [0, 1, 2]],
    ['*', [0, 0, 0]],
  ] as const)('%s weighs %j', (selector, expected) => {
    expect(specificityOf(selector)).toEqual(expected);
  });

  it.each([
    'html, body',
    '& .card',
    '.card &',
    'li:nth-child(2n + 1 of .card)',
    'li:nth-last-child(1 of .a, .b)',
  ])('refuses %s rather than weigh it wrongly', (selector) => {
    expect(() => specificityOf(selector)).toThrow('Cannot weigh selector');
  });

  it('orders ids before classes before types', () => {
    expect(compareSpecificity([0, 2, 1], [0, 2, 0])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 9], [0, 2, 0])).toBeLessThan(0);
    expect(compareSpecificity([1, 0, 0], [0, 9, 9])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 2, 0], [0, 2, 0])).toBe(0);
  });
});
