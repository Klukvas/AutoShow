import { AiCredentialsService } from '../ai-credentials/ai-credentials.service';
import { AiCredentials } from '../ai-credentials/entities/ai-credentials.entity';
import { PhotoAiSettings } from './entities/photo-ai-settings.entity';

type PhotoRow = {
  id: number;
  enabled: boolean;
  revision: number;
  accessMode: string;
  selectedEditorIds: string[];
};
type CredentialRow = { id: number; encryptedKey: string | null; revision: number };
/** Both singletons seen at once; `revision` is the photo settings revision. */
export type SettingsView = PhotoRow & { encryptedKey: string | null; keyRevision: number };

/**
 * In-memory stand-in for the photo_ai_settings and ai_credentials rows behind
 * one fake EntityManager, wired to a real AiCredentialsService.
 */
export function fakeAiSettingsStore(config: Record<string, unknown>) {
  let photo: PhotoRow = {
    id: 1,
    enabled: false,
    revision: 0,
    accessMode: 'all',
    selectedEditorIds: [],
  };
  let credential: CredentialRow = { id: 1, encryptedKey: null, revision: 0 };
  const queryFor = (entity: unknown) => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => (entity === AiCredentials ? { ...credential } : { ...photo })),
  });
  const em = {
    createQueryBuilder: jest.fn((entity: unknown) => queryFor(entity)),
    update: jest.fn(async (entity: unknown, _criteria: unknown, patch: object) => {
      if (entity === AiCredentials) credential = { ...credential, ...patch };
      else if (entity === PhotoAiSettings) photo = { ...photo, ...patch };
      else throw new Error('unexpected entity');
      return { affected: 1 };
    }),
  };
  const manager = {
    ...em,
    transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)),
  };
  const credentials = new AiCredentialsService({ manager } as never, config as never);
  const row = (): SettingsView => ({
    ...photo,
    encryptedKey: credential.encryptedKey,
    keyRevision: credential.revision,
  });
  const setRow = ({
    encryptedKey,
    ...patch
  }: Partial<PhotoRow & { encryptedKey: string | null }>) => {
    photo = { ...photo, ...patch };
    if (encryptedKey !== undefined) credential = { ...credential, encryptedKey };
  };
  return { repo: { manager }, em, credentials, row, setRow };
}
