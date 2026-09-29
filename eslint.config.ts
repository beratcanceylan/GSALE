import expoConfig from 'eslint-config-expo/flat';
import type { Linter } from 'eslint';
import { configs as tseslintConfigs } from 'typescript-eslint';
import gsalePlugin from './eslint-plugin';

const typedFiles = ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', 'eslint-plugin/**/*.ts'];

const config: Linter.Config[] = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.scannerwork/**',
      'dist/**',
      'web-build/**',
      'aggregator.js',
      'eslint-env.d.ts',
      '**/*.test.ts',
    ],
  },
  ...expoConfig,
  {
    files: ['index.ts'],
    rules: {
      'import/first': 'off',
      'no-console': 'off',
    },
  },
  ...tseslintConfigs.strictTypeChecked.map((entry) => ({
    ...entry,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: {
      gsale: gsalePlugin,
    },
    rules: {
      'no-console': 'error',
      'gsale/enforce-design-tokens': 'error',
      'gsale/no-react-effects': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'expo-av', message: 'Use expo-audio or expo-video instead.' },
            {
              name: '@react-native-community/async-storage',
              message: 'Use expo-secure-store or expo-sqlite instead.',
            },
            {
              name: '@react-native-picker/picker',
              message: 'Use @react-native-picker/picker is forbidden.',
            },
            { name: 'expo-permissions', message: 'Use expo-permissions is forbidden.' },
            { name: '@expo/vector-icons', message: 'Use lucide-react-native instead.' },
          ],
          patterns: [
            { group: ['expo-av/**'], message: 'Use expo-audio or expo-video instead.' },
            { group: ['@expo/vector-icons/**'], message: 'Use lucide-react-native instead.' },
          ],
        },
      ],
    },
  },
];

export default config;
