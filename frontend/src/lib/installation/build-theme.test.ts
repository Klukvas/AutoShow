import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type BuiltTheme = { inlined: string; homeSlot: string };

/** Loads next.config.mjs the way `next build` does, with only STOREFRONT_THEME varied. */
function loadConfig(storefrontTheme: string | undefined): BuiltTheme {
  const { STOREFRONT_THEME: _ignored, ...inherited } = process.env;
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      // A stand-in webpack records the replacement plugin, then applies it to a slot import.
      `const {default:c}=await import('./next.config.mjs');` +
        `class NormalModuleReplacementPlugin{constructor(pattern,rewrite){Object.assign(this,{pattern,rewrite})}}` +
        `const w=c.webpack({context:process.cwd(),resolve:{alias:{}},plugins:[]},{webpack:{NormalModuleReplacementPlugin},defaultLoaders:{},isServer:true,dev:false,dir:process.cwd(),config:c});` +
        `const plugin=w.plugins.find((p)=>p instanceof NormalModuleReplacementPlugin&&p.pattern.test('@theme/home'));` +
        `const resource={request:'@theme/home'};plugin.rewrite(resource);` +
        `process.stdout.write(JSON.stringify({inlined:c.env.STOREFRONT_THEME,homeSlot:resource.request}))`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...inherited,
        NODE_ENV: 'production',
        ...(storefrontTheme === undefined ? {} : { STOREFRONT_THEME: storefrontTheme }),
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return JSON.parse(result) as BuiltTheme;
}

const homeSlotOf = (id: string) => join(process.cwd(), 'src/themes', id, 'home');

describe('build-time storefront theme', () => {
  it('builds the current theme when STOREFRONT_THEME is unset', () => {
    expect(loadConfig(undefined)).toEqual({ inlined: 'current', homeSlot: homeSlotOf('current') });
  });

  it('points @theme/<slot> imports and the inlined id at the selected theme folder', () => {
    expect(loadConfig('compact')).toEqual({ inlined: 'compact', homeSlot: homeSlotOf('compact') });
  });

  it.each(['nope', '', '../current', 'Current'])(
    'fails the build for %j instead of falling back to another design',
    (value) => {
      // Not the list of folders that follows: it grows with every new theme.
      expect(() => loadConfig(value)).toThrow(
        `Invalid STOREFRONT_THEME=${JSON.stringify(value)}: expected one of `,
      );
    },
  );
});
