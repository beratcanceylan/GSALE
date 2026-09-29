import { describe, expect, mock, test } from 'bun:test';
import { sqliteMock } from '../../../test-support/sqlite-mock';

type Manifest = { version: string; file: string; bytes: number; rows: number };
const files = new Map<string, string>();
let directoryExists = false;
let opens = 0;
let closes = 0;
let downloads = 0;
let downloadedBytes = 0;

class Directory {
  readonly uri = 'document/catalog';
  get exists() { return directoryExists; }
  create() { directoryExists = true; }
}

class File {
  readonly path: string;
  constructor(_directory: Directory, name: string) { this.path = name; }
  get exists() { return files.has(this.path); }
  get size() { return downloadedBytes; }
  text() { return Promise.resolve(files.get(this.path) ?? ''); }
  write(value: string) { files.set(this.path, value); }
  delete() { files.delete(this.path); }
  async move(target: File) {
    files.set(target.path, files.get(this.path) ?? '');
    files.delete(this.path);
  }
  static async downloadFileAsync(_url: string, target: File) {
    downloads += 1;
    files.set(target.path, 'sqlite payload');
    return target;
  }
}

mock.module('expo-file-system', () => ({ Directory, File, Paths: { document: 'document' } }));
sqliteMock.openAsync = async () => {
  opens += 1;
  return { closeAsync: async () => { closes += 1; } };
};
const { loadCatalog } = await import('@/services/catalog/loader');
const originalFetch = globalThis.fetch;
const oldBase = process.env.EXPO_PUBLIC_CATALOG_BASE_URL;

function remoteManifest(manifest: Manifest | null): void {
  globalThis.fetch = async () => manifest ? Response.json(manifest) : new Response('', { status: 404 });
}

describe('catalog download and activation', () => {
  test('rejects an unsafe base and keeps searching live', async () => {
    process.env.EXPO_PUBLIC_CATALOG_BASE_URL = 'http://example.com/catalog';
    await loadCatalog();
    expect(directoryExists).toBeFalse();
    expect(opens).toBe(0);
  });

  test('creates the directory and waits when no manifest is published', async () => {
    process.env.EXPO_PUBLIC_CATALOG_BASE_URL = 'https://example.com/catalog/';
    remoteManifest(null);
    await loadCatalog();
    expect(directoryExists).toBeTrue();
    expect(downloads).toBe(0);
  });

  test('opens a valid local copy and ignores an unchanged remote release', async () => {
    const local = { version: '2026-09-01', file: 'catalog.db', bytes: 14, rows: 1 };
    files.set('catalog.db', 'existing catalog');
    files.set('catalog-manifest.json', JSON.stringify(local));
    remoteManifest(local);
    await loadCatalog();
    expect(opens).toBe(1);
    expect(downloads).toBe(0);
  });

  test('keeps the current copy when the download byte count is wrong', async () => {
    const next = { version: '2026-09-02', file: 'catalog.db', bytes: 20, rows: 2 };
    files.set('catalog.download', 'stale partial');
    downloadedBytes = 14;
    remoteManifest(next);
    await loadCatalog();
    expect(files.has('catalog.download')).toBeFalse();
    expect(files.get('catalog.db')).toBe('existing catalog');
    expect(closes).toBe(0);
  });

  test('swaps a complete download and closes the prior connection', async () => {
    const next = { version: '2026-09-03', file: 'catalog.db', bytes: 14, rows: 2 };
    downloadedBytes = 14;
    remoteManifest(next);
    await loadCatalog();
    expect(files.get('catalog.db')).toBe('sqlite payload');
    expect(JSON.parse(files.get('catalog-manifest.json') ?? '{}')).toEqual(next);
    expect(closes).toBe(1);
    expect(opens).toBe(2);
  });

  test('ignores malformed manifests and network failures', async () => {
    files.set('catalog-manifest.json', '{broken');
    globalThis.fetch = async () => { throw new Error('offline'); };
    await loadCatalog();
    files.set('catalog-manifest.json', JSON.stringify({ version: 1 }));
    remoteManifest({ version: '2026-09-04', file: 'catalog.db', bytes: 20, rows: 3 });
    await loadCatalog();
    expect(downloads).toBe(3);
  });

  test('shares an in-flight update across callers', async () => {
    let finish: ((response: Response) => void) | undefined;
    globalThis.fetch = async () => new Promise<Response>((resolve) => { finish = resolve; });
    const first = loadCatalog();
    const second = loadCatalog();
    expect(first).toBe(second);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(typeof finish).toBe('function');
    finish?.(new Response('', { status: 404 }));
    await first;
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.EXPO_PUBLIC_CATALOG_BASE_URL;
    else process.env.EXPO_PUBLIC_CATALOG_BASE_URL = oldBase;
  });
});
