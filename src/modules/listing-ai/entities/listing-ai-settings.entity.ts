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
  /** Brand voice: the prompt treats these as style data, never as instructions. */
  @Column({ name: 'brand_tone', type: 'varchar', length: 500, nullable: true }) brandTone!:
    | string
    | null;
  @Column({
    name: 'brand_banned_words',
    type: 'varchar',
    length: 40,
    array: true,
    default: () => "'{}'::varchar(40)[]",
  })
  brandBannedWords!: string[];
  @Column({ name: 'brand_example', type: 'varchar', length: 2000, nullable: true })
  brandExample!: string | null;
}
