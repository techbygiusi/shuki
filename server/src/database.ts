import Database from 'better-sqlite3';
import path from 'path';

export function initDatabase(dataPath: string): Database.Database {
  const dbPath = path.join(dataPath, 'shuki.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      folder_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Folder',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add folder_id column if missing
  try {
    db.prepare('SELECT folder_id FROM notes LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE notes ADD COLUMN folder_id TEXT DEFAULT NULL');
  }

  return db;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  tags: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: number;
}

export interface FolderRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted: number;
}
