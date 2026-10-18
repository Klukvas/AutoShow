import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ListingAiAccessMode } from '../listing-ai.types';

/**
 * Singleton: the description feature's own switch and editor access policy.
 * The provider key is shared and lives in ai_credentials.
 */
@Entity('listing_ai_settings')
export class ListingAiSettings {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ type: 'integer', default: 0 }) revision!: number;
  @Column({ name: 'access_mode', type: 'varchar', length: 12, default: 'all' })
  accessMode!: ListingAiAccessMode;
  @Column({ name: 'selected_editor_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  selectedEditorIds!: string[];
}
