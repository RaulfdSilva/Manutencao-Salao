import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configureApp({ config }: ConfigContext): ExpoConfig {
  const publicPreview = process.env.GITHUB_PAGES_PREVIEW === '1';
  return {
    ...config,
    name: config.name ?? 'Manutenção Salão',
    slug: config.slug ?? 'manutencao-salao',
    ...(publicPreview
      ? {
          web: { ...config.web, output: 'static' },
          experiments: { ...config.experiments, baseUrl: '/Manutencao-Salao' },
        }
      : {}),
  };
}
