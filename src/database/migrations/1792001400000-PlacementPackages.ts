import type { MigrationInterface, QueryRunner } from 'typeorm';

interface StarterPackage {
  title: string;
  description: string;
  priceUah: number;
  channels: string[];
  features: string[];
  isFeatured: boolean;
}

/**
 * Starter templates, inserted HIDDEN: the prices are examples, and a deploy
 * must not put them on a live storefront. The admin edits and publishes them.
 * Seeded here rather than in run-seeds so a deleted template stays deleted.
 */
const STARTER_PACKAGES: StarterPackage[] = [
  {
    title: 'Instagram',
    description: 'Пост у нашому Instagram з фото та описом вашого авто.',
    priceUah: 100,
    channels: ['instagram_post'],
    features: ['Пост у стрічці', 'Фото та опис авто', 'Ваш телефон для покупців'],
    isFeatured: false,
  },
  {
    title: 'Instagram + історія',
    description: 'Пост у стрічці та історія — більше переглядів у перші дні.',
    priceUah: 200,
    channels: ['instagram_post', 'instagram_story'],
    features: ['Пост у стрічці', 'Історія з посиланням на пост', 'Ваш телефон для покупців'],
    isFeatured: false,
  },
  {
    title: 'Telegram',
    description: 'Пост із фотоальбомом у нашому Telegram-каналі.',
    priceUah: 200,
    channels: ['telegram'],
    features: ['Фотоальбом до 10 фото', 'Опис і ціна авто', 'Ваш телефон для покупців'],
    isFeatured: false,
  },
  {
    title: 'Усі канали',
    description: 'Сайт, Instagram і Telegram одночасно — найбільше охоплення.',
    priceUah: 400,
    channels: ['site', 'instagram_post', 'instagram_story', 'telegram'],
    features: ['Оголошення на сайті', 'Instagram: пост та історія', 'Пост у Telegram-каналі'],
    isFeatured: true,
  },
];

/**
 * Paid placement tariffs for the storefront homepage ("Instagram post — 100
 * грн"). New table → expand-only; the runtime role gets its grants through
 * the schema's default privileges like every other admin-curated table.
 */
export class PlacementPackages1792001400000 implements MigrationInterface {
  name = 'PlacementPackages1792001400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "placement_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL DEFAULT '1',
        "title" character varying(80) NOT NULL,
        "description" character varying(500),
        "price_uah" integer NOT NULL,
        "channels" character varying(24)[] NOT NULL DEFAULT '{}',
        "features" character varying(120)[] NOT NULL DEFAULT '{}',
        "is_featured" boolean NOT NULL DEFAULT false,
        "is_published" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL DEFAULT '0',
        CONSTRAINT "pk_placement_packages" PRIMARY KEY ("id"),
        CONSTRAINT "ck_placement_packages_price" CHECK (price_uah >= 0),
        CONSTRAINT "ck_placement_packages_channels" CHECK (
          channels <@ ARRAY['site', 'instagram_post', 'instagram_story', 'telegram', 'tiktok']::varchar(24)[]
        ),
        CONSTRAINT "ck_placement_packages_features" CHECK (cardinality(features) <= 8)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_placement_packages_published_position" ON "placement_packages" ("is_published", "position")`,
    );
    for (const [position, pkg] of STARTER_PACKAGES.entries()) {
      await queryRunner.query(
        `INSERT INTO "placement_packages"
          ("title", "description", "price_uah", "channels", "features", "is_featured", "is_published", "position")
          VALUES ($1, $2, $3, $4::varchar(24)[], $5::varchar(120)[], $6, false, $7)`,
        [
          pkg.title,
          pkg.description,
          pkg.priceUah,
          pkg.channels,
          pkg.features,
          pkg.isFeatured,
          position,
        ],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "placement_packages"`);
  }
}
