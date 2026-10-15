import { isUUID } from 'class-validator';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { PhotoAiSettings } from './entities/photo-ai-settings.entity';

export type PhotoAiAccessMode = 'admins' | 'all' | 'selected';
export const PHOTO_AI_ACCESS_DENIED = 'Власник сайту не надав вам доступу до обробки фото з ШІ.';
export type PhotoAiPermission = { permitted: boolean; permissionReason: string | null };

@Injectable()
export class PhotoAiAccessService {
  constructor(
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
    @InjectRepository(PhotoAiSettings) private readonly settings: Repository<PhotoAiSettings>,
  ) {}
  private liveUser(id: string) {
    return this.users.findOne({
      where: { id, isActive: true, deletedAt: IsNull() },
      select: ['id', 'role'],
    });
  }
  async requireAdmin(actorId: string): Promise<void> {
    if ((await this.liveUser(actorId))?.role !== 'admin')
      throw new ForbiddenException('Налаштування ШІ доступні лише активним адміністраторам.');
  }
  async permission(actorId: string): Promise<PhotoAiPermission> {
    const actor = await this.liveUser(actorId);
    if (actor?.role === 'admin') return { permitted: true, permissionReason: null };
    const policy =
      actor?.role === 'editor'
        ? await this.settings.findOne({
            where: { id: 1 },
            select: ['accessMode', 'selectedEditorIds'],
          })
        : null;
    const valid =
      policy &&
      ['admins', 'all', 'selected'].includes(policy.accessMode) &&
      Array.isArray(policy.selectedEditorIds) &&
      policy.selectedEditorIds.length <= 200 &&
      new Set(policy.selectedEditorIds).size === policy.selectedEditorIds.length &&
      policy.selectedEditorIds.every((id) => typeof id === 'string' && isUUID(id, 'all'));
    const permitted = Boolean(
      valid &&
      policy &&
      (policy.accessMode === 'all' ||
        (policy.accessMode === 'selected' && policy.selectedEditorIds.includes(actorId))),
    );
    return { permitted, permissionReason: permitted ? null : PHOTO_AI_ACCESS_DENIED };
  }
  async requireAllowed(actorId: string): Promise<void> {
    if (!(await this.permission(actorId)).permitted)
      throw new ForbiddenException(PHOTO_AI_ACCESS_DENIED);
  }
  async staff(actorId: string): Promise<Array<{ id: string; email: string }>> {
    await this.requireAdmin(actorId);
    const users = await this.users.find({
      where: { role: 'editor', isActive: true, deletedAt: IsNull() },
      select: ['id', 'email'],
      order: { email: 'ASC' },
    });
    return users.map(({ id, email }) => ({ id, email }));
  }
  async validateSelected(ids: string[]): Promise<void> {
    if (ids.length > 200 || new Set(ids).size !== ids.length)
      throw new BadRequestException('Оберіть до 200 різних активних редакторів.');
    if (!ids.length) return;
    const eligible = await this.users.count({
      where: { id: In(ids), role: 'editor', isActive: true, deletedAt: IsNull() },
    });
    if (eligible !== ids.length)
      throw new BadRequestException(
        'Список містить недоступного співробітника. Оновіть список редакторів.',
      );
  }
}
