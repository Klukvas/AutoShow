import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Curated SEO collections moved from hardcoded frontend/sitemap arrays into the
 * DB so a single source drives the storefront landing pages AND the sitemap
 * (previously two lists that silently drifted). Admin-editable. Soft-deletable
 * with a partial-unique key like the other reference tables. New table →
 * expand-only; the seed backfills the original five presets idempotently.
 */
export class AddCollections1784800000000 implements MigrationInterface {
  name = 'AddCollections1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "collections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL DEFAULT '1',
        "key" character varying(64) NOT NULL,
        "emoji" character varying(16),
        "title_uk" character varying(160) NOT NULL,
        "description_uk" character varying(500),
        "query" jsonb NOT NULL DEFAULT '{}',
        "position" integer NOT NULL DEFAULT '0',
        "is_published" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_collections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_collections_key_alive" ON "collections" ("key")
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_collections_published_position" ON "collections" ("is_published", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "collections"`);
  }
}
