import { apiFetch } from '../api/client';
import { fetchAccessToken } from '../auth/use-access-token';

export type PhotoAiCategory = 'enhance' | 'scene';
export type PhotoAiPreset = { id: string; name: string; category: PhotoAiCategory; prompt: string };
export type PhotoAiGeneration = {
  id: string;
  category: PhotoAiCategory;
  prompt: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'interrupted';
  failureReason: string | null;
  createdAt: string;
  sceneAltered: boolean;
  previewUrl: string | null;
};
export type PhotoAiAllowedWorkspace = {
  permitted: true;
  permissionReason: null;
  enabled: boolean;
  reason: string | null;
  mediaId: string;
  revision: number;
  activeGenerationId: string | null;
  originalUrl: string;
  history: PhotoAiGeneration[];
  builtins: PhotoAiPreset[];
  presets: PhotoAiPreset[];
};
export type PhotoAiWorkspace =
  | PhotoAiAllowedWorkspace
  | { permitted: false; permissionReason: string };
export type PhotoAiAccessMode = 'admins' | 'all' | 'selected';

async function call<T>(
  path: string,
  body?: unknown,
  method?: 'GET' | 'POST' | 'PATCH',
): Promise<T> {
  const accessToken = await fetchAccessToken();
  if (!accessToken) throw new Error('Сесія закінчилася. Увійдіть знову.');
  return apiFetch<T>(path, {
    accessToken,
    cache: 'no-store',
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    body,
  });
}
const pathFor = (id: string) => `/admin/media/${id}/photo-ai`;
export const photoAiApi = {
  workspace: (id: string) => call<PhotoAiWorkspace>(pathFor(id)),
  generate: (id: string, body: { requestId: string; category: PhotoAiCategory; prompt: string }) =>
    call<PhotoAiGeneration>(`${pathFor(id)}/generations`, body),
  apply: (id: string, generationId: string, expectedRevision: number) =>
    call<{ revision: number }>(`${pathFor(id)}/apply`, {
      generationId,
      expectedRevision,
      reviewed: true,
    }),
  restore: (id: string, expectedRevision: number) =>
    call<{ revision: number }>(`${pathFor(id)}/restore`, { expectedRevision }),
  savePreset: (body: Omit<PhotoAiPreset, 'id'>) =>
    call<PhotoAiPreset>('/admin/photo-ai/presets', body),
};
export function scenePrompt(
  background: string,
  time: string,
  lighting: string,
  extra: string,
): string {
  return [
    `Background: ${background.trim()}.`,
    `Time of day: ${time.trim()}.`,
    `Lighting and weather: ${lighting.trim()}.`,
    extra.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}
export function photoAiStatus(status: PhotoAiGeneration['status']): string {
  return {
    queued: 'У черзі',
    processing: 'Створюємо варіант',
    ready: 'Готово до перегляду',
    failed: 'Не вдалося створити',
    interrupted: 'Обробку перервано',
  }[status];
}

export type PhotoAiAttempt = { requestId: string; category: PhotoAiCategory; prompt: string };
export function generationAttempt(
  previous: PhotoAiAttempt | null,
  category: PhotoAiCategory,
  prompt: string,
  createId: () => string = () => crypto.randomUUID(),
): PhotoAiAttempt {
  const clean = prompt.trim();
  return previous?.category === category && previous.prompt === clean
    ? previous
    : { requestId: createId(), category, prompt: clean };
}

export type PhotoAiSettingsMetadata = {
  accessMode: PhotoAiAccessMode;
  selectedEditorIds: string[];
  configured: boolean;
  enabled: boolean;
  available: boolean;
  setupAvailable: boolean;
  revision: number;
  status: 'ready' | 'disabled' | 'not-configured' | 'unavailable';
};
export const photoAiSettingsApi = {
  staff: () => call<Array<{ id: string; email: string }>>('/admin/photo-ai/settings/staff'),
  get: () => call<PhotoAiSettingsMetadata>('/admin/photo-ai/settings'),
  update: (body: {
    expectedRevision: number;
    accessMode?: PhotoAiAccessMode;
    selectedEditorIds?: string[];
    enabled?: boolean;
    apiKey?: string;
    removeKey?: boolean;
  }) => call<PhotoAiSettingsMetadata>('/admin/photo-ai/settings', body, 'PATCH'),
};
