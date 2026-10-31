const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  { ignores: ['dist/**', 'coverage/**', '.expo/**', 'expo-env.d.ts'] },
  expoConfig,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'import/no-cycle': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: [
                './src/application',
                './src/infrastructure',
                './src/presentation',
                './app',
                './src/composition',
              ],
            },
            {
              target: './src/application',
              from: [
                './src/infrastructure',
                './src/presentation',
                './app',
                './src/composition',
              ],
            },
            {
              target: './src/infrastructure',
              from: ['./src/presentation', './app', './src/composition'],
            },
            {
              target: './src/presentation',
              from: ['./src/infrastructure', './app', './src/composition'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?![.]|@/domain(?:/|$)|@/application(?:/|$))',
              message:
                'Internal layers must remain independent of external frameworks and SDKs.',
            },
          ],
        },
      ],
    },
  },
]);
