import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lead mini-CRM: assign a lead to a team member, schedule a follow-up, and keep
 * an append-only note thread. Columns are nullable and the notes table is new,
 * so this is expand-only and safe with the still-running old app.
 *
 * `assignee_id` → admin_users ON DELETE SET NULL: removing a teammate must not
 * cascade-delete their leads, just unassign them. `lead_notes` cascades from
 * the lead (a deleted lead's notes are meaningless).
 */
export class AddLeadCrm1784600000000 implements MigrationInterface {
  name = 'AddLeadCrm1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" ADD "assignee_id" uuid`);
    await queryRunner.query(`ALTER TABLE "leads" ADD "follow_up_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`
      ALTER TABLE "leads" ADD CONSTRAINT "fk_leads_assignee"
        FOREIGN KEY ("assignee_id") REFERENCES "admin_users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "ix_leads_assignee" ON "leads" ("assignee_id")`);
    // Partial index powers a "due follow-ups" view without scanning leads that
    // have no scheduled follow-up.
    await queryRunner.query(`
      CREATE INDEX "ix_leads_follow_up" ON "leads" ("follow_up_at")
        WHERE follow_up_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "lead_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lead_id" uuid NOT NULL,
        "author_id" uuid,
        "author_role" character varying(32),
        "text" text NOT NULL,
        CONSTRAINT "pk_lead_notes" PRIMARY KEY ("id"),
        CONSTRAINT "fk_lead_notes_lead" FOREIGN KEY ("lead_id")
          REFERENCES "leads"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lead_notes_author" FOREIGN KEY ("author_id")
          REFERENCES "admin_users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_lead_notes_lead" ON "lead_notes" ("lead_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lead_notes"`);
    await queryRunner.query(`DROP INDEX "ix_leads_follow_up"`);
    await queryRunner.query(`DROP INDEX "ix_leads_assignee"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "fk_leads_assignee"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "follow_up_at"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "assignee_id"`);
  }
}
