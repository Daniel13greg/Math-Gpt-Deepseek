import { DEFAULT_SETTINGS, migrateSettings } from '../settings';

// Hoisted above the import by babel-jest.
jest.mock('@/lib/storage/kv', () => ({ kv: { getItemSync: () => null, setItem: () => {}, removeItem: () => {} } }));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => null, set: async () => {} } }));

describe('migrateSettings', () => {
  it('turns Deep Think on once for installs from before it became the default', () => {
    const migrated = migrateSettings({ model: 'deepseek-v4-pro', thinking: false, theme: 'dark' });
    expect(migrated.thinking).toBe(true);
    expect(migrated.model).toBe('deepseek-v4-pro');
    expect(migrated.theme).toBe('dark');
    expect(migrated.version).toBe(DEFAULT_SETTINGS.version);
  });

  it('respects turning Deep Think off after the migration', () => {
    expect(migrateSettings({ version: 2, thinking: false }).thinking).toBe(false);
  });

  it('defaults to Deep Think on', () => {
    expect(DEFAULT_SETTINGS.thinking).toBe(true);
  });
});
