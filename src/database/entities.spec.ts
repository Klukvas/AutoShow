import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { ListingTelegramPost } from '../modules/telegram/entities/listing-telegram-post.entity';
import { ALL_ENTITIES } from './entities';

const MODULES_DIR = join(__dirname, '..', 'modules');

/** Every `*.entity.ts` under `src/modules/<module>/entities/`. */
function entityFilePaths(): string[] {
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const entitiesDir = join(MODULES_DIR, entry.name, 'entities');
      if (!existsSync(entitiesDir)) return [];
      return readdirSync(entitiesDir)
        .filter((file) => file.endsWith('.entity.ts'))
        .map((file) => join(entitiesDir, file));
    });
}

function entityName(target: unknown): string {
  return typeof target === 'function' ? target.name : String(target);
}

describe('ALL_ENTITIES', () => {
  it('registers the Telegram post entity, so its repository resolves at runtime', () => {
    // DatabaseModule runs with autoLoadEntities: false — a module-level
    // forFeature() is not enough, the class must be in this list too.
    expect(ALL_ENTITIES).toContain(ListingTelegramPost);
  });

  it('has no duplicate entries', () => {
    const duplicates = ALL_ENTITIES.filter(
      (entity, index) => ALL_ENTITIES.indexOf(entity) !== index,
    ).map(entityName);

    expect(duplicates).toEqual([]);
  });

  it('registers every @Entity class found under src/modules', () => {
    for (const filePath of entityFilePaths()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(filePath);
    }

    const registered = new Set<unknown>(ALL_ENTITIES);
    const missing = getMetadataArgsStorage()
      .tables.map((table) => table.target)
      .filter((target) => !registered.has(target))
      .map(entityName);

    expect(missing).toEqual([]);
  });
});
