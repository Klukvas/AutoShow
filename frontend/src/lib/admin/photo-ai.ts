import { apiFetch } from '../api/client';
import { fetchAccessToken } from '../auth/use-access-token';

export type PhotoAiCategory = 'enhance' | 'scene';
/** The owner's own saved instruction. */
export type PhotoAiPreset = { id: string; name: string; category: PhotoAiCategory; prompt: string };
/** Our preset: its instructions stay on the server, only the summary is shown. */
export type PhotoAiBuiltin = {
  id: string;
  name: string;
  category: PhotoAiCategory;
  description: string;
};
export type PhotoAiGeneration = {
  id: string;
  category: PhotoAiCategory;
  presetId: string | null;
  presetName: string | null;
  /** The owner's own instruction, or their wishes added to a preset. */
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
  builtins: PhotoAiBuiltin[];
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
  generate: (id: string, body: PhotoAiAttempt) =>
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

export type PhotoAiAttempt = {
  requestId: string;
  category: PhotoAiCategory;
  presetId?: string;
  prompt: string;
};
export function generationAttempt(
  previous: PhotoAiAttempt | null,
  category: PhotoAiCategory,
  presetId: string | null,
  prompt: string,
  createId: () => string = () => crypto.randomUUID(),
): PhotoAiAttempt {
  const clean = prompt.trim();
  const preset = presetId ?? undefined;
  return previous?.category === category &&
    previous.presetId === preset &&
    previous.prompt === clean
    ? previous
    : { requestId: createId(), category, ...(preset ? { presetId: preset } : {}), prompt: clean };
}
/** One history line: a preset run shows its name and any wishes, never its instructions. */
export function generationLabel(generation: Pick<PhotoAiGeneration, 'presetName' | 'prompt'>) {
  return [generation.presetName, generation.prompt].filter(Boolean).join(' · ');
}

export type PhotoAiSettingsMetadata = {
  /** own_key: the owner's OpenAI key; managed: provided key, photos sold in packs. */
  mode: 'own_key' | 'managed';
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
