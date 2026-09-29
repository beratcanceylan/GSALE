/**
 * Builds the SQLite game catalog the app downloads.
 *
 *   bun run scripts/catalog/build.ts --source <game-store-catalog checkout> --out <dir>
 *
 * Writes <out>/catalog.db and <out>/catalog-manifest.json.
 */
import { Database } from 'bun:sqlite';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CATALOG_DB_NAME,
  CATALOG_MANIFEST_NAME,
  CATALOG_SCHEMA_SQL,
  type CatalogManifest,
  type CatalogStore,
} from '@/services/catalog/schema';

import { SOURCE_DIRECTORIES, sourceRecordToRow, type CatalogRow } from './source';

function argument(name: string, args: readonly string[]): string {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

/** Per-letter files (`a.json` … `z.json`, `_.json`); `!.json` duplicates them and `$.json` is metadata. */
function readStoreRecords(sourceDir: string, directory: string): unknown[] {
  const dir = join(sourceDir, directory);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== '!.json' && name !== '$.json')
    .flatMap((name) => {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    });
}

function readSourceDate(sourceDir: string, directory: string): string {
  const parsed: unknown = JSON.parse(readFileSync(join(sourceDir, directory, '$.json'), 'utf8'));
  const date = typeof parsed === 'object' && parsed !== null ? (parsed as { date?: unknown }).date : undefined;
  return typeof date === 'string' ? date : '';
}

export function buildCatalog(args: readonly string[] = process.argv): void {
  const sourceDir = argument('source', args);
  const outDir = argument('out', args);
  mkdirSync(outDir, { recursive: true });
  const dbPath = join(outDir, CATALOG_DB_NAME);
  rmSync(dbPath, { force: true });

  const db = new Database(dbPath, { create: true });
  db.exec(CATALOG_SCHEMA_SQL);
  const insert = db.prepare('INSERT INTO games (store, id, title, search_key, image) VALUES (?, ?, ?, ?, ?)');
  const insertAll = db.transaction((rows: CatalogRow[]) => {
    for (const row of rows) {
      insert.run(row.store, row.id, row.title, row.search_key, row.image);
    }
  });

  let rowCount = 0;
  const sourceDates: string[] = [];
  for (const [store, directory] of Object.entries(SOURCE_DIRECTORIES) as [CatalogStore, string][]) {
    // The table has no primary key (smaller file), so duplicate ids are dropped here.
    const seen = new Set<string>();
    const rows = readStoreRecords(sourceDir, directory).flatMap((record) => {
      const row = sourceRecordToRow(store, record);
      if (!row || seen.has(row.id)) return [];
      seen.add(row.id);
      return [row];
    });
    insertAll(rows);
    rowCount += rows.length;
    sourceDates.push(readSourceDate(sourceDir, directory));
    console.log(`${store}: ${rows.length} rows`);
  }

  const version = sourceDates.filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1) ?? new Date().toISOString();
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('version', version);
  db.exec('VACUUM');
  db.close();

  const manifest: CatalogManifest = {
    version,
    file: CATALOG_DB_NAME,
    bytes: statSync(dbPath).size,
    rows: rowCount,
  };
  writeFileSync(join(outDir, CATALOG_MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`catalog ${version}: ${rowCount} rows, ${(manifest.bytes / 1e6).toFixed(1)} MB`);
}

if (import.meta.main) buildCatalog();
