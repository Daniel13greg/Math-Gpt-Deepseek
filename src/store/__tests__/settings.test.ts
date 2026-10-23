import { DEFAULT_BASE_URL } from '@/lib/ai/models';

import { DEFAULT_SETTINGS, migrateSettings } from '../settings';

// Hoisted above the import by babel-jest.
jest.mock('@/lib/storage/kv', () => ({ kv: { getItemSync: () => null, setItem: () => {}, removeItem: () => {} } }));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => null, set: async () => {} } }));

describe('migrateSettings', () => {
  it('drops the model choice and Deep Think settings older versions saved', () => {
    const migrated = migrateSettings({ model: 'deepseek-v4-pro', thinking: false, reasoningEffort: 'max', theme: 'dark' });
    expect(migrated).not.toHaveProperty('model');
    expect(migrated).not.toHaveProperty('thinking');
    expect(migrated).not.toHaveProperty('reasoningEffort');
    expect(migrated.theme).toBe('dark');
    expect(migrated.version).toBe(DEFAULT_SETTINGS.version);
  });

  it('forgets a saved copy of the built-in server address but keeps a custom server', () => {
    expect(migrateSettings({ version: 2, baseUrl: `${DEFAULT_BASE_URL}/` }).baseUrl).toBe('');
    expect(migrateSettings({ version: 2, baseUrl: 'https://proxy.example.com' }).baseUrl).toBe('https://proxy.example.com');
  });
});
