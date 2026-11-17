import { describe, expect, it } from 'vitest';
import { placeholderCount } from './favorites-placeholders';

describe('placeholderCount', () => {
  it('shows one placeholder per saved car between three and six', () => {
    expect([0, 2, 3, 5, 6, 40].map(placeholderCount)).toEqual([3, 3, 3, 5, 6, 6]);
  });
});
