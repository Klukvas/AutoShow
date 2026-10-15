import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import type { PhotoAiCategory } from '../photo-ai.types';

@Entity('photo_ai_presets')
@Index('ix_photo_ai_preset_actor', ['actorId'])
export class PhotoAiPreset extends BaseEntity {
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ type: 'varchar', length: 80 }) name!: string;
  @Column({ type: 'varchar', length: 12 }) category!: PhotoAiCategory;
  @Column({ type: 'text' }) prompt!: string;
}
