import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';

// Конфиг Expo (flat) + отключение правил, дублирующих Prettier.
// Форматирование — задача Prettier, ESLint только проверяет.
export default defineConfig([
  {
    ignores: [
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'node_modules/**',
      'assets/**',
      'package-lock.json',
    ],
  },
  expoConfig,
  prettierConfig,
  {
    // scripts/*.ts запускаются нативным Node (type stripping), не Metro.
    files: ['scripts/**/*.ts'],
    rules: {
      // Разрешаем явные расширения .ts в импортах (требование Node ESM).
      'import/extensions': 'off',
    },
  },
]);
