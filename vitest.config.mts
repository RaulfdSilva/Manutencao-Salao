import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Render shared native components through their web implementation in Node.
  // Browser navigation and device validation remain separate checks.
  resolve: { alias: { 'react-native': 'react-native-web' } },

  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
