import { isAiAccessPermitted } from '../ai-credentials/ai-access.policy';
import { requireActiveAdmin, validateSelectedEditors } from '../ai-credentials/ai-access.staff';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
    await requireActiveAdmin(this.users, actorId);
  }
  async permission(actorId: string): Promise<PhotoAiPermission> {
    const actor = await this.liveUser(actorId);
    const policy =
      actor?.role === 'editor'
        ? await this.settings.findOne({
            where: { id: 1 },
            select: ['accessMode', 'selectedEditorIds'],
          })
        : null;
    const permitted = isAiAccessPermitted(actor, policy);
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
    await validateSelectedEditors(this.users, ids);
  }
}
