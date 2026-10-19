import { isUUID } from 'class-validator';

export type AiAccessMode = 'admins' | 'all' | 'selected';
export type AiAccessPolicy = { accessMode: string; selectedEditorIds: unknown };
export type AiAccessActor = { id: string; role: string } | null;

const MAX_SELECTED = 200;

/**
 * Who may use an AI feature. Admins always may; editors per the owner's
 * policy. A malformed stored policy denies editors rather than guessing.
 */
export function isAiAccessPermitted(actor: AiAccessActor, policy: AiAccessPolicy | null): boolean {
  if (actor?.role === 'admin') return true;
  if (actor?.role !== 'editor' || !policy) return false;
  const ids = policy.selectedEditorIds;
  const valid =
    ['admins', 'all', 'selected'].includes(policy.accessMode) &&
    Array.isArray(ids) &&
    ids.length <= MAX_SELECTED &&
    new Set(ids).size === ids.length &&
    ids.every((id) => typeof id === 'string' && isUUID(id, 'all'));
  if (!valid) return false;
  return (
    policy.accessMode === 'all' ||
    (policy.accessMode === 'selected' && (ids as string[]).includes(actor.id))
  );
}
