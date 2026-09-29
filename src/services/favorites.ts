import * as SQLite from 'expo-sqlite';

const DB_NAME = 'gsale_favorites.db';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync(`
      CREATE TABLE IF NOT EXISTS favorites (
        game_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        image_url TEXT,
        platform TEXT,
        price TEXT,
        discount TEXT,
        original_price TEXT,
        created_at INTEGER NOT NULL
      );
    `);
  }
  return db;
}

export interface FavoriteGame {
  game_id: string;
  title: string;
  image_url: string | null;
  platform: string | null;
  price: string | null;
  discount: string | null;
  original_price: string | null;
  created_at: number;
}

function addFavorite(game: {
  id: string;
  title: string;
  imageUrl?: string;
  platform?: string;
  price?: string;
  discount?: string;
  originalPrice?: string | undefined;
}): void {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO favorites (game_id, title, image_url, platform, price, discount, original_price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    game.id,
    game.title,
    game.imageUrl || '',
    game.platform || '',
    game.price || '',
    game.discount || '',
    game.originalPrice || '',
    Date.now()
  );
}

function removeFavorite(gameId: string): void {
  const database = getDb();
  database.runSync('DELETE FROM favorites WHERE game_id = ?', gameId);
}

export function getFavorites(): FavoriteGame[] {
  const database = getDb();
  const rows = database.getAllSync<FavoriteGame>('SELECT * FROM favorites ORDER BY created_at DESC');
  return rows;
}

export function isFavorite(gameId: string): boolean {
  const database = getDb();
  const row = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites WHERE game_id = ?',
    gameId
  );
  return (row?.count ?? 0) > 0;
}

export function toggleFavorite(game: {
  id: string;
  title: string;
  imageUrl?: string;
  platform?: string;
  price?: string;
  discount?: string;
  originalPrice?: string | undefined;
}): boolean {
  const fav = isFavorite(game.id);
  if (fav) {
    removeFavorite(game.id);
    return false;
  } else {
    addFavorite(game);
    return true;
  }
}
