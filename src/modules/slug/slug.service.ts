import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';

interface SlugCheck {
  exists: (candidate: string) => Promise<boolean>;
}

@Injectable()
export class SlugService {
  toSlug(input: string): string {
    const value = input
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96)
      .replace(/-+$/g, '');
    return value || nanoid(8);
  }

  async unique(base: string, check: SlugCheck, suffixLen = 6): Promise<string> {
    const baseSlug = this.toSlug(base);
    if (!(await check.exists(baseSlug))) return baseSlug;

    // Append a short non-incrementing tail to avoid `slug-2`-style probing
    // races (two writers can both pick `-2`) — nanoid makes the slug unique
    // by construction.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${baseSlug}-${nanoid(suffixLen)}`;
      if (!(await check.exists(candidate))) return candidate;
    }
    throw new Error(`Failed to find a unique slug for ${base}`);
  }
}
