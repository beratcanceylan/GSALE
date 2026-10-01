import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  CATALOG_DB_NAME,
  CATALOG_MANIFEST_NAME,
  isCatalogManifest,
  type CatalogManifest,
} from '@/services/catalog/schema';
import { setActiveCatalog } from '@/services/catalog/state';
import { trimTrailingChar } from '@/services/store/text';

const CATALOG_DIRECTORY = 'catalog';
const DOWNLOAD_NAME = 'catalog.download';
const MANIFEST_TIMEOUT_MS = 10_000;
const HTTPS_BASE_PATTERN = /^https:\/\/[^\s?#]+$/i;

let openDb: SQLiteDatabase | null = null;
let pending: Promise<void> | null = null;

/** GitHub release download base, e.g. https://github.com/<owner>/<repo>/releases/download/catalog-latest */
function catalogBaseUrl(): string | null {
  // Must stay a literal `process.env.EXPO_PUBLIC_…` access so Expo can inline it.
  const base = trimTrailingChar(process.env.EXPO_PUBLIC_CATALOG_BASE_URL ?? 'https://github.com/beratcanceylan/GSALE/releases/download/catalog-latest', '/');
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

  const local = await readLocalManifest(manifestFile);
  // Search works from the existing copy while the update check runs.
  const [, remote] = await Promise.all([
    local && dbFile.exists && !openDb ? activate(directory, local) : Promise.resolve(),
    fetchRemoteManifest(base),
  ]);
  if (remote && remote.version !== local?.version) {
    await replaceCatalog(base, directory, remote);
  }
}

/** Downloads a new catalog next to the current one and swaps it in once complete. */
async function replaceCatalog(base: string, directory: Directory, remote: CatalogManifest): Promise<void> {
  const target = new File(directory, DOWNLOAD_NAME);
  if (target.exists) target.delete();
  const download = await File.downloadFileAsync(`${base}/${remote.file}`, target, { idempotent: true });
  if (download.size !== remote.bytes) {
    download.delete();
    return;
  }

  await deactivate();
  await download.move(new File(directory, CATALOG_DB_NAME), { overwrite: true });
  new File(directory, CATALOG_MANIFEST_NAME).write(JSON.stringify(remote));
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
