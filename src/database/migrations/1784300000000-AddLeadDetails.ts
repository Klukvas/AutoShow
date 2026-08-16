import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Structured payload for sell_request/credit leads (car being sold, credit
 * calculator inputs). Previously these fields were folded into the free-text
 * message only — filters/analytics/CRM would have had to parse a string.
 * Nullable jsonb, expand-only: safe with the still-running old app.
 */
export class AddLeadDetails1784300000000 implements MigrationInterface {
  name = 'AddLeadDetails1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" ADD "details" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "details"`);
  }
}
