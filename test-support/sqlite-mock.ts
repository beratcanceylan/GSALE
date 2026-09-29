import { mock } from 'bun:test';
import type { FavoriteGame } from '@/services/favorites';

/** Shared module shape so catalog and favorites tests can run in one Bun process. */
export const sqliteMock = {
  favoriteRows: new Map<string, FavoriteGame>(),
  favoriteStatements: [] as string[],
  favoriteOpens: 0,
  openSync(name: string): unknown {
    if (name !== 'gsale_favorites.db') throw new Error(`Unexpected database: ${name}`);
    sqliteMock.favoriteOpens += 1;
    return {
      execSync: (sql: string) => { sqliteMock.favoriteStatements.push(sql); },
      runSync: (sql: string, ...args: unknown[]) => {
        sqliteMock.favoriteStatements.push(sql);
        if (sql.startsWith('DELETE')) {
          sqliteMock.favoriteRows.delete(String(args[0]));
          return;
        }
        sqliteMock.favoriteRows.set(String(args[0]), {
          game_id: String(args[0]), title: String(args[1]), image_url: String(args[2]),
          platform: String(args[3]), price: String(args[4]), discount: String(args[5]),
          original_price: String(args[6]), created_at: Number(args[7]),
        });
      },
      getFirstSync: (_sql: string, id: string) => ({ count: sqliteMock.favoriteRows.has(id) ? 1 : 0 }),
      getAllSync: () => [...sqliteMock.favoriteRows.values()].sort((a, b) => b.created_at - a.created_at),
    };
  },
  openAsync: async (): Promise<unknown> => { throw new Error('openAsync not configured'); },
};

mock.module('expo-sqlite', () => ({
  openDatabaseSync: (name: string) => sqliteMock.openSync(name),
  openDatabaseAsync: () => sqliteMock.openAsync(),
}));
