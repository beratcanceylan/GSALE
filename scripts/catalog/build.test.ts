import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { SOURCE_DIRECTORIES } from './source';
import { buildCatalog } from './build';

describe('catalog builder', () => {
  test('writes a searchable database and manifest from source records', async () => {
    const root = join('/tmp', `gsale-catalog-test-${crypto.randomUUID()}`);
    const source = join(root, 'source');
    const out = join(root, 'out');
    try {
      for (const directory of Object.values(SOURCE_DIRECTORIES)) {
        const path = join(source, directory);
        mkdirSync(path, { recursive: true });
        writeFileSync(join(path, '$.json'), JSON.stringify({ date: '2026-09-01T00:00:00Z' }));
        writeFileSync(join(path, 'a.json'), JSON.stringify([
          { uuid: `${directory}-1`, name: `${directory} Game`, type: 'game' },
          { uuid: `${directory}-1`, name: 'Duplicate id', type: 'game' },
          { uuid: `${directory}-2`, name: 'Unavailable', price: 'Unavailable' },
        ]));
        writeFileSync(join(path, '!.json'), JSON.stringify([{ uuid: 'ignored', name: 'Duplicate file' }]));
        writeFileSync(join(path, 'b.json'), JSON.stringify({ not: 'an array' }));
      }
      buildCatalog(['bun', 'build.ts', '--source', source, '--out', out]);

      const manifest = JSON.parse(readFileSync(join(out, 'catalog-manifest.json'), 'utf8')) as {
        version: string; bytes: number; rows: number; file: string;
      };
      expect(manifest).toMatchObject({ version: '2026-09-01T00:00:00Z', rows: 5, file: 'catalog.db' });
      expect(manifest.bytes).toBeGreaterThan(0);
      const db = new Database(join(out, 'catalog.db'), { readonly: true });
      try {
        expect(db.query('SELECT COUNT(*) AS count FROM games').get()).toEqual({ count: 5 });
        expect(db.query("SELECT value FROM meta WHERE key = 'version'").get()).toEqual({ value: manifest.version });
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('requires both source and output arguments', () => {
    expect(() => buildCatalog(['bun', 'build.ts'])).toThrow('missing --source');
    expect(() => buildCatalog(['bun', 'build.ts', '--source', '/tmp/unused'])).toThrow('missing --out');
  });
});
