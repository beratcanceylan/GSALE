import { describe, expect, mock, test } from 'bun:test';

import './test-support/native-mocks';

mock.module('expo-router/entry', () => ({}));
mock.module('@/services/catalog/loader', () => ({ loadCatalog: () => undefined }));
mock.module('@/services/country', () => ({ loadAppCountry: async () => 'TR' }));
mock.module('@/services/screenData', () => ({ watchRegionChanges: () => () => undefined }));
mock.module('@/i18n/bootstrap', () => ({ loadAppLanguage: async () => undefined }));
mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { reportBootstrapFailure } = await import('./index');

describe('entry bootstrap', () => {
  test('logs an asynchronous startup failure with its task name', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    try {
      reportBootstrapFailure('startup task', Promise.reject(new Error('offline')));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(warnings[0]?.[0]).toBe('startup task failed');
      expect(warnings[0]?.[1]).toMatchObject({ message: 'offline' });
    } finally {
      console.warn = originalWarn;
    }
  });
});
