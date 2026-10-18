import type { PhotoAiAccessMode } from '../photo-ai-access.service';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Separate singleton: unrelated branding saves never touch AI state. The key
 * itself lives in ai_credentials; the legacy encrypted_key column is no longer
 * read and is dropped in a later release (see migration 1792001000000).
 */
@Entity('photo_ai_settings')
export class PhotoAiSettings {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ type: 'integer', default: 0 }) revision!: number;
  @Column({ name: 'access_mode', type: 'varchar', length: 12, default: 'all' })
  accessMode!: PhotoAiAccessMode;
  @Column({ name: 'selected_editor_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  selectedEditorIds!: string[];
}
