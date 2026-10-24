import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const expoConfigSchema = z.object({
  expo: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    plugins: z
      .array(z.string())
      .refine((plugins) => plugins.includes('expo-router')),
  }),
});

describe('bootstrap tooling', () => {
  it('validates the actual Expo configuration with Zod', () => {
    const configuration: unknown = JSON.parse(
      readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
    );
    expect(expoConfigSchema.safeParse(configuration).success).toBe(true);
  });

  it('rejects an invalid external configuration', () => {
    expect(expoConfigSchema.safeParse({ expo: { name: 42 } }).success).toBe(
      false,
    );
  });
});
