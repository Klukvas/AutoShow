import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Curated marketing/deal tags ("обмін", "терміновий продаж", "розстрочка") — a
 * cross-cutting label that is neither a vehicle spec (catalog_vehicle_options)
 * nor a SEO filter preset (collections). Admin curates the dictionary; the
 * storefront shows them as badges and filters by them (?tags[]=obmin), exactly
 * like vehicle options. New tables → expand-only; the seed backfills a starter
 * set idempotently. `is_published` hides a tag from the storefront (filter +
 * badge) without deleting it, mirroring collections.
 */
export class AddTags1784900000000 implements MigrationInterface {
  name = 'AddTags1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE catalog_tags (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name_uk      varchar(64) NOT NULL,
        name_en      varchar(64),
        slug         varchar(64) NOT NULL,
        position     integer NOT NULL DEFAULT 0,
        is_published boolean NOT NULL DEFAULT true,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        deleted_at   timestamptz,
        version      integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_tags_slug_alive"
       ON catalog_tags(slug) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_catalog_tags_published_position"
       ON catalog_tags(is_published, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE listing_tags (
        listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        tag_id     uuid NOT NULL REFERENCES catalog_tags(id) ON DELETE RESTRICT,
        PRIMARY KEY (listing_id, tag_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_listing_tags_tag" ON listing_tags(tag_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS listing_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_tags`);
  }
}
