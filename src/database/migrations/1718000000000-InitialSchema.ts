import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for AutoFlow (single-business car sales platform).
 *
 * Notes:
 *  - The `app_user` runtime role is created via the docker-entrypoint init
 *    script (docker/postgres/init/01-roles.sh); this migration only GRANTs
 *    privileges on freshly created tables. Migrations run as the owner role.
 *  - All "unique" constraints on entities that support soft delete are
 *    materialized as partial-unique indexes `WHERE deleted_at IS NULL` so a
 *    deleted row doesn't permanently squat the slug/email.
 *  - `site_settings` is a singleton: a partial unique index on a constant
 *    expression guarantees at most one alive row.
 */
export class InitialSchema1718000000000 implements MigrationInterface {
  name = 'InitialSchema1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'app_user';

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    /* ============================================================
     *  SiteSettings (singleton: branding + base currency)
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE site_settings (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        logo_url         varchar(512),
        favicon_url      varchar(512),
        primary_color    varchar(9) NOT NULL DEFAULT '#0F172A',
        accent_color     varchar(9) NOT NULL DEFAULT '#2563EB',
        display_name     varchar(128) NOT NULL,
        tagline          varchar(255),
        contact_phone    varchar(32),
        contact_email    varchar(254),
        address          varchar(512),
        working_hours    jsonb,
        social_links     jsonb,
        seo_defaults     jsonb,
        default_currency varchar(3) NOT NULL DEFAULT 'USD',
        created_at       timestamptz(3) NOT NULL DEFAULT now(),
        updated_at       timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at       timestamptz,
        version          integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_site_settings_currency CHECK (default_currency IN ('USD','UAH','EUR'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_site_settings_singleton" ON site_settings((true)) WHERE deleted_at IS NULL`,
    );

    /* ============================================================
     *  AdminUser
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email                   varchar(254) NOT NULL,
        password_hash           varchar(512) NOT NULL,
        role                    varchar(32) NOT NULL,
        is_active               boolean NOT NULL DEFAULT true,
        last_login_at           timestamptz,
        failed_login_attempts   integer NOT NULL DEFAULT 0,
        locked_until            timestamptz,
        created_at              timestamptz(3) NOT NULL DEFAULT now(),
        updated_at              timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at              timestamptz,
        version                 integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_admin_users_role CHECK (role IN ('admin','editor'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_admin_users_email_alive"
       ON admin_users(email)
       WHERE deleted_at IS NULL`,
    );

    /* ============================================================
     *  Catalog (reference data)
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE catalog_makes (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name_uk    varchar(128) NOT NULL,
        name_en    varchar(128),
        slug       varchar(64) NOT NULL,
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        version    integer NOT NULL DEFAULT 1
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_makes_slug_alive" ON catalog_makes(slug) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE catalog_models (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        make_id    uuid NOT NULL REFERENCES catalog_makes(id) ON DELETE CASCADE,
        name_uk    varchar(128) NOT NULL,
        name_en    varchar(128),
        slug       varchar(64) NOT NULL,
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        version    integer NOT NULL DEFAULT 1
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_models_make_slug_alive"
       ON catalog_models(make_id, slug) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(`CREATE INDEX "ix_catalog_models_make" ON catalog_models(make_id)`);

    for (const name of [
      'catalog_body_types',
      'catalog_fuel_types',
      'catalog_transmissions',
      'catalog_drive_types',
    ]) {
      await queryRunner.query(`
        CREATE TABLE ${name} (
          id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name_uk    varchar(64) NOT NULL,
          name_en    varchar(64),
          slug       varchar(64) NOT NULL,
          created_at timestamptz(3) NOT NULL DEFAULT now(),
          updated_at timestamptz(3) NOT NULL DEFAULT now(),
          deleted_at timestamptz,
          version    integer NOT NULL DEFAULT 1
        );
      `);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_${name}_slug_alive" ON ${name}(slug) WHERE deleted_at IS NULL`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE catalog_colors (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name_uk    varchar(64) NOT NULL,
        name_en    varchar(64),
        slug       varchar(64) NOT NULL,
        hex        varchar(9),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        version    integer NOT NULL DEFAULT 1
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_colors_slug_alive" ON catalog_colors(slug) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE catalog_vehicle_options (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category   varchar(32) NOT NULL,
        name_uk    varchar(128) NOT NULL,
        name_en    varchar(128),
        slug       varchar(64) NOT NULL,
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        version    integer NOT NULL DEFAULT 1
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_vehicle_options_slug_alive"
       ON catalog_vehicle_options(slug) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_catalog_vehicle_options_category" ON catalog_vehicle_options(category)`,
    );

    /* ============================================================
     *  Listings
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE listings (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug              varchar(128) NOT NULL,
        status            varchar(16) NOT NULL DEFAULT 'draft',

        make_id           uuid NOT NULL REFERENCES catalog_makes(id) ON DELETE RESTRICT,
        model_id          uuid NOT NULL REFERENCES catalog_models(id) ON DELETE RESTRICT,
        generation        varchar(64),
        modification      varchar(128),
        year              integer NOT NULL,
        mileage_km        integer NOT NULL,
        vin               varchar(17),
        vin_visible       boolean NOT NULL DEFAULT false,

        body_type_id      uuid NOT NULL REFERENCES catalog_body_types(id) ON DELETE RESTRICT,
        fuel_type_id      uuid NOT NULL REFERENCES catalog_fuel_types(id) ON DELETE RESTRICT,
        transmission_id   uuid NOT NULL REFERENCES catalog_transmissions(id) ON DELETE RESTRICT,
        drive_type_id     uuid NOT NULL REFERENCES catalog_drive_types(id) ON DELETE RESTRICT,
        color_id          uuid NOT NULL REFERENCES catalog_colors(id) ON DELETE RESTRICT,

        engine_volume_l   numeric(3,1) NOT NULL,
        power_hp          integer NOT NULL,
        condition         varchar(16) NOT NULL,
        owners_count      integer NOT NULL DEFAULT 1,
        is_crashed        boolean NOT NULL DEFAULT false,
        customs_cleared   boolean NOT NULL DEFAULT true,

        price_amount      numeric(12,2) NOT NULL,
        price_currency    varchar(3) NOT NULL,
        price_normalized  numeric(14,2) NOT NULL,
        fx_rate           numeric(12,6),
        fx_rate_at        timestamptz,
        is_negotiable     boolean NOT NULL DEFAULT false,

        title             varchar(255) NOT NULL,
        description       text NOT NULL,
        location_city     varchar(128) NOT NULL,
        location_region   varchar(128),
        meta_title        varchar(255),
        meta_description  varchar(320),

        source_type       varchar(16) NOT NULL DEFAULT 'manual',
        external_id       varchar(128),

        views_count       integer NOT NULL DEFAULT 0,
        published_at      timestamptz(3),
        sold_at           timestamptz,

        created_at        timestamptz(3) NOT NULL DEFAULT now(),
        updated_at        timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at        timestamptz,
        version           integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_listings_status CHECK (status IN ('draft','published','reserved','sold','archived')),
        CONSTRAINT ck_listings_condition CHECK (condition IN ('new','used','damaged')),
        CONSTRAINT ck_listings_currency CHECK (price_currency IN ('USD','UAH','EUR')),
        CONSTRAINT ck_listings_source CHECK (source_type IN ('manual','feed','parser')),
        CONSTRAINT ck_listings_year CHECK (year BETWEEN 1900 AND 2100),
        CONSTRAINT ck_listings_mileage CHECK (mileage_km >= 0),
        CONSTRAINT ck_listings_price CHECK (price_amount > 0 AND price_normalized > 0)
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_listings_slug_alive"
       ON listings(slug) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_status_published"
       ON listings(status, published_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_make_model"
       ON listings(make_id, model_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_price"
       ON listings(price_normalized) WHERE status = 'published' AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_published_id"
       ON listings(published_at DESC, id DESC) WHERE status = 'published' AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_created_id"
       ON listings(created_at DESC, id DESC) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_listings_external"
       ON listings(source_type, external_id) WHERE external_id IS NOT NULL`,
    );

    /* ============================================================
     *  ListingOption (join table)
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE listing_options (
        listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        option_id   uuid NOT NULL REFERENCES catalog_vehicle_options(id) ON DELETE RESTRICT,
        PRIMARY KEY (listing_id, option_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_listing_options_option" ON listing_options(option_id)`,
    );

    /* ============================================================
     *  ListingMedia + MediaRendition
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE listing_media (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        type            varchar(8) NOT NULL,
        original_s3_key varchar(512) NOT NULL,
        status          varchar(16) NOT NULL DEFAULT 'pending',
        width           integer,
        height          integer,
        size_bytes      bigint,
        mime            varchar(64),
        position        integer NOT NULL DEFAULT 0,
        is_cover        boolean NOT NULL DEFAULT false,
        alt             varchar(255),
        failure_reason  varchar(512),
        created_at      timestamptz(3) NOT NULL DEFAULT now(),
        updated_at      timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at      timestamptz,
        version         integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_listing_media_type   CHECK (type IN ('image','video')),
        CONSTRAINT ck_listing_media_status CHECK (status IN ('pending','processing','ready','failed'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_listing_media_listing_position" ON listing_media(listing_id, position)`,
    );
    await queryRunner.query(`CREATE INDEX "ix_listing_media_status" ON listing_media(status)`);
    // At most one cover image per listing (enforces setCover's invariant).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_listing_media_cover" ON listing_media(listing_id)
       WHERE is_cover AND deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE media_renditions (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        media_id    uuid NOT NULL REFERENCES listing_media(id) ON DELETE CASCADE,
        variant     varchar(16) NOT NULL,
        format      varchar(8)  NOT NULL,
        s3_key      varchar(512) NOT NULL,
        width       integer NOT NULL,
        height      integer NOT NULL,
        size_bytes  bigint NOT NULL,
        created_at  timestamptz(3) NOT NULL DEFAULT now(),
        updated_at  timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at  timestamptz,
        version     integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_media_renditions_variant CHECK (variant IN ('thumb','gallery','full')),
        CONSTRAINT ck_media_renditions_format  CHECK (format  IN ('webp','avif','jpeg'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_media_renditions_media_variant_format"
       ON media_renditions(media_id, variant, format)`,
    );

    /* ============================================================
     *  Leads
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE leads (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id  uuid REFERENCES listings(id) ON DELETE SET NULL,
        type        varchar(16) NOT NULL,
        name        varchar(128) NOT NULL,
        phone       varchar(32) NOT NULL,
        email       varchar(254),
        message     text,
        status      varchar(16) NOT NULL DEFAULT 'new',
        source_url  varchar(1024),
        utm         jsonb,
        ip_hash     varchar(64),
        created_at  timestamptz(3) NOT NULL DEFAULT now(),
        updated_at  timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at  timestamptz,
        version     integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_leads_type   CHECK (type IN ('callback','message','test_drive')),
        CONSTRAINT ck_leads_status CHECK (status IN ('new','in_progress','done','spam'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_leads_status_created" ON leads(status, created_at DESC, id DESC)`,
    );
    await queryRunner.query(`CREATE INDEX "ix_leads_created" ON leads(created_at DESC, id DESC)`);
    await queryRunner.query(`CREATE INDEX "ix_leads_listing" ON leads(listing_id)`);

    /* ============================================================
     *  Reservations (FUTURE)
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE reservations (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        customer_name   varchar(128) NOT NULL,
        customer_phone  varchar(32) NOT NULL,
        deposit_amount  numeric(12,2) NOT NULL,
        deposit_currency varchar(3) NOT NULL,
        status          varchar(16) NOT NULL DEFAULT 'pending',
        expires_at      timestamptz,
        created_at      timestamptz(3) NOT NULL DEFAULT now(),
        updated_at      timestamptz(3) NOT NULL DEFAULT now(),
        deleted_at      timestamptz,
        version         integer NOT NULL DEFAULT 1,

        CONSTRAINT ck_reservations_status CHECK (status IN ('pending','confirmed','cancelled','expired')),
        CONSTRAINT ck_reservations_currency CHECK (deposit_currency IN ('USD','UAH','EUR'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "ix_reservations_listing" ON reservations(listing_id)`);
    await queryRunner.query(`CREATE INDEX "ix_reservations_status" ON reservations(status)`);

    /* ============================================================
     *  Audit log
     * ============================================================ */
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id        uuid,
        actor_role      varchar(32),
        action          varchar(128) NOT NULL,
        entity_type     varchar(64) NOT NULL,
        entity_id       uuid,
        diff            jsonb,
        correlation_id  varchar(64),
        created_at      timestamptz(3) NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_audit_logs_created" ON audit_logs(created_at DESC, id DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_audit_logs_entity" ON audit_logs(entity_type, entity_id)`,
    );

    /* ============================================================
     *  Grant privileges to the runtime app user
     * ============================================================ */
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appUser}`,
    );
    await queryRunner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appUser}`);
    // Audit log is append-only; the runtime user may INSERT and SELECT but must
    // not be able to rewrite or erase history. Migrations run as the owner.
    await queryRunner.query(`REVOKE UPDATE, DELETE ON audit_logs FROM ${appUser}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS reservations`);
    await queryRunner.query(`DROP TABLE IF EXISTS leads`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_renditions`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_media`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_options`);
    await queryRunner.query(`DROP TABLE IF EXISTS listings`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_vehicle_options`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_colors`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_drive_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_transmissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_fuel_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_body_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_models`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_makes`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_users`);
    await queryRunner.query(`DROP TABLE IF EXISTS site_settings`);
  }
}
