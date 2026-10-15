import type { PhotoAiAccessMode } from '../photo-ai-access.service';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Separate singleton: unrelated branding saves never touch credential state. */
@Entity('photo_ai_settings')
export class PhotoAiSettings {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ name: 'encrypted_key', type: 'text', nullable: true, select: false }) encryptedKey!:
    | string
    | null;
  @Column({ type: 'integer', default: 0 }) revision!: number;
  @Column({ name: 'access_mode', type: 'varchar', length: 12, default: 'all' })
  accessMode!: PhotoAiAccessMode;
  @Column({ name: 'selected_editor_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  selectedEditorIds!: string[];
}
