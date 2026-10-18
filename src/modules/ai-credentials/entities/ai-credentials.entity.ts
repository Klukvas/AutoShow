import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Singleton: the site's AI provider key, shared by every AI feature. */
@Entity('ai_credentials')
export class AiCredentials {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ name: 'encrypted_key', type: 'text', nullable: true, select: false }) encryptedKey!:
    | string
    | null;
  @Column({ type: 'integer', default: 0 }) revision!: number;
}
