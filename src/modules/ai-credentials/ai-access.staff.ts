import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { In, IsNull, type Repository } from 'typeorm';
import type { AdminUser } from '../admin-users/entities/admin-user.entity';

/** Staff checks shared by every AI feature's settings. */

export async function requireActiveAdmin(
  users: Repository<AdminUser>,
  actorId: string,
): Promise<void> {
  const actor = await users.findOne({
    where: { id: actorId, isActive: true, deletedAt: IsNull() },
    select: ['id', 'role'],
  });
  if (actor?.role !== 'admin')
    throw new ForbiddenException('Налаштування ШІ доступні лише активним адміністраторам.');
}

/** Selected editors must be distinct, active editors, at most 200. */
export async function validateSelectedEditors(
  users: Repository<AdminUser>,
  ids: string[],
): Promise<void> {
  if (ids.length > 200 || new Set(ids).size !== ids.length)
    throw new BadRequestException('Оберіть до 200 різних активних редакторів.');
  if (!ids.length) return;
  const eligible = await users.count({
    where: { id: In(ids), role: 'editor', isActive: true, deletedAt: IsNull() },
  });
  if (eligible !== ids.length)
    throw new BadRequestException(
      'Список містить недоступного співробітника. Оновіть список редакторів.',
    );
}
