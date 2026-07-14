import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Shared columns for every business entity:
 *  - uuid PK
 *  - created_at / updated_at maintained by ORM
 *  - deleted_at for soft delete (paired with partial-unique indexes
 *    `WHERE deleted_at IS NULL`)
 *  - version for optimistic locking (raises on concurrent edits)
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @VersionColumn({ name: 'version', default: 1 })
  version!: number;
}
