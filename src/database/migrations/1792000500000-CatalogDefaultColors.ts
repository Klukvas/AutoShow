import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the default color dictionary beyond the original six seed colors.
 *
 * Fixed ids let down() remove exactly the rows this migration inserted —
 * never a same-slug color an admin created by hand.
 */
const DEFAULT_COLORS = [
  {
    id: 'ea15a997-f8d4-49c3-8bf7-ced5ccc1f667',
    slug: 'beige',
    nameUk: 'Бежевий',
    nameEn: 'Beige',
    hex: '#D8C8A8',
  },
  {
    id: 'ad5df663-5797-419a-b5bc-6a9199fe5015',
    slug: 'brown',
    nameUk: 'Коричневий',
    nameEn: 'Brown',
    hex: '#6B4226',
  },
  {
    id: '4ca65648-b1e2-4776-89cf-2508c9362fc7',
    slug: 'green',
    nameUk: 'Зелений',
    nameEn: 'Green',
    hex: '#2F6B3A',
  },
  {
    id: '0962adbe-b792-4dc5-bb6f-2f6d88a07690',
    slug: 'orange',
    nameUk: 'Помаранчевий',
    nameEn: 'Orange',
    hex: '#E36A1C',
  },
  {
    id: 'a5cc7fdc-d2cb-44fd-8306-6bd9023a4ce1',
    slug: 'yellow',
    nameUk: 'Жовтий',
    nameEn: 'Yellow',
    hex: '#F2C230',
  },
  {
    id: '67119027-0872-4690-85c3-6bf6f8797966',
    slug: 'burgundy',
    nameUk: 'Бордовий',
    nameEn: 'Burgundy',
    hex: '#6D1A2C',
  },
  {
    id: '878d21b0-8bff-4f9d-8d14-8c536835cd7b',
    slug: 'gold',
    nameUk: 'Золотистий',
    nameEn: 'Gold',
    hex: '#C9A54C',
  },
  {
    id: 'eeea77aa-cbd0-49bf-9cc9-3ec0e9452774',
    slug: 'graphite',
    nameUk: 'Графітовий',
    nameEn: 'Graphite',
    hex: '#3F4246',
  },
  {
    id: '84af8a09-315f-4329-ab55-5221c75fd8b6',
    slug: 'dark-blue',
    nameUk: 'Темно-синій',
    nameEn: 'Dark blue',
    hex: '#1B2A4A',
  },
  {
    id: '542ef3fc-7793-4799-a4dd-f13f615a6043',
    slug: 'light-blue',
    nameUk: 'Блакитний',
    nameEn: 'Light blue',
    hex: '#7FB3E0',
  },
  {
    id: '40487611-f0ad-4cbd-bab2-81f3ab6c6978',
    slug: 'purple',
    nameUk: 'Фіолетовий',
    nameEn: 'Purple',
    hex: '#5B3A8C',
  },
  {
    id: '8798e2dd-2136-4827-b0d6-fbb8607b3bb5',
    slug: 'pearl-white',
    nameUk: 'Перламутровий білий',
    nameEn: 'Pearl white',
    hex: '#F1EEE6',
  },
] as const;

export class CatalogDefaultColors1792000500000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const color of DEFAULT_COLORS) {
      // Partial unique index (alive rows only) rules out ON CONFLICT; skip a
      // color whose slug or name an admin already has, leaving that row as is.
      await queryRunner.query(
        `INSERT INTO catalog_colors (id, slug, name_uk, name_en, hex)
         SELECT $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM catalog_colors
           WHERE deleted_at IS NULL
             AND (slug = $2::varchar OR LOWER(TRIM(name_uk)) = LOWER($3::varchar))
         )
         AND NOT EXISTS (SELECT 1 FROM catalog_colors WHERE id = $1::uuid)`,
        [color.id, color.slug, color.nameUk, color.nameEn, color.hex],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Colors already used by listings (even archived/soft-deleted ones) stay.
    await queryRunner.query(
      `DELETE FROM catalog_colors c
       WHERE c.id = ANY($1::uuid[])
         AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.color_id = c.id)`,
      [DEFAULT_COLORS.map((color) => color.id)],
    );
  }
}
