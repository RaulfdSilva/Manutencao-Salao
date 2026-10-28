import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigContext } from 'expo/config';
import configureApp from '../../app.config';

const context: ConfigContext = {
  projectRoot: '/tmp/preview-config',
  staticConfigPath: null,
  packageJsonPath: null,
  config: {
    name: 'Manutenção Salão',
    slug: 'manutencao-salao',
    userInterfaceStyle: 'dark',
    web: { bundler: 'metro', output: 'single' },
  },
};
afterEach(() => vi.unstubAllEnvs());
describe('Expo public preview configuration', () => {
  it('preserves normal development at the root and does not mutate static config', () => {
    vi.stubEnv('GITHUB_PAGES_PREVIEW', '');
    expect(configureApp(context)).toEqual(context.config);
    expect(configureApp(context).experiments?.baseUrl).toBeUndefined();
  });
  it('uses the SDK 58 baseUrl and static export only for the explicit Pages build flag', () => {
    vi.stubEnv('GITHUB_PAGES_PREVIEW', '1');
    const result = configureApp(context);
    expect(result.web?.output).toBe('static');
    expect(result.web?.bundler).toBe('metro');
    expect(result.experiments?.baseUrl).toBe('/Manutencao-Salao');
    expect(result.userInterfaceStyle).toBe('dark');
    expect(context.config.web?.output).toBe('single');
  });
});
