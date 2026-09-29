import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  CATALOG_DB_NAME,
  CATALOG_MANIFEST_NAME,
  isCatalogManifest,
  type CatalogManifest,
} from '@/services/catalog/schema';
import { setActiveCatalog } from '@/services/catalog/state';

const CATALOG_DIRECTORY = 'catalog';
const DOWNLOAD_NAME = 'catalog.download';
const MANIFEST_TIMEOUT_MS = 10_000;
const HTTPS_BASE_PATTERN = /^https:\/\/[^\s?#]+$/i;

let openDb: SQLiteDatabase | null = null;
let pending: Promise<void> | null = null;

/** GitHub release download base, e.g. https://github.com/<owner>/<repo>/releases/download/catalog-latest */
function catalogBaseUrl(): string | null {
  // Must stay a literal `process.env.EXPO_PUBLIC_…` access so Expo can inline it.
  const base = (process.env.EXPO_PUBLIC_CATALOG_BASE_URL ?? '').replace(/\/+$/, '');
  return HTTPS_BASE_PATTERN.test(base) ? base : null;
}

async function readLocalManifest(file: File): Promise<CatalogManifest | null> {
  if (!file.exists) return null;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return isCatalogManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchRemoteManifest(base: string): Promise<CatalogManifest | null> {
  try {
    const res = await fetch(`${base}/${CATALOG_MANIFEST_NAME}`, {
      signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return isCatalogManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function activate(directory: Directory, manifest: CatalogManifest): Promise<void> {
  openDb = await openDatabaseAsync(CATALOG_DB_NAME, { useNewConnection: true }, directory.uri);
  setActiveCatalog({ db: openDb, version: manifest.version });
}

async function deactivate(): Promise<void> {
  setActiveCatalog(null);
  const db = openDb;
  openDb = null;
  await db?.closeAsync();
}

async function syncCatalog(): Promise<void> {
  const base = catalogBaseUrl();
  if (!base) return;

  const directory = new Directory(Paths.document, CATALOG_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
  const dbFile = new File(directory, CATALOG_DB_NAME);
  const manifestFile = new File(directory, CATALOG_MANIFEST_NAME);

  // Search works from the existing copy while the update check runs.
  const remoteRequest = fetchRemoteManifest(base);
  const local = await readLocalManifest(manifestFile);
  if (local && dbFile.exists && !openDb) await activate(directory, local);

  const remote = await remoteRequest;
  if (!remote || remote.version === local?.version) return;

  const download = new File(directory, DOWNLOAD_NAME);
  if (download.exists) download.delete();
  await File.downloadFileAsync(`${base}/${remote.file}`, download, { idempotent: true });
  if (download.size !== remote.bytes) {
    download.delete();
    return;
  }

  await deactivate();
  await download.move(dbFile, { overwrite: true });
  manifestFile.write(JSON.stringify(remote));
  await activate(directory, remote);
}

/**
 * Opens the downloaded catalog and fetches a newer one when the release changed.
 * Failures leave the app on live store search only.
 */
export function loadCatalog(): Promise<void> {
  pending ??= syncCatalog()
    .catch(() => undefined)
    .finally(() => {
      pending = null;
    });
  return pending;
}
