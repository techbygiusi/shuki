import Database from 'better-sqlite3';
import path from 'path';

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface LocalDatabase {
  getAllNotes: () => LocalNote[];
  getNote: (id: string) => LocalNote | undefined;
  saveNote: (note: { id: string; title: string; content: string; tags: string[]; updatedAt: string; synced: boolean }) => void;
  deleteNote: (id: string) => void;
  getPendingNotes: () => LocalNote[];
  markSynced: (id: string) => void;
  clearAll: () => void;
}

export function initLocalDb(userDataPath: string): LocalDatabase {
  const dbPath = path.join(userDataPath, 'notesync-local.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  return {
    getAllNotes() {
      return db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as LocalNote[];
    },
    getNote(id: string) {
      return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as LocalNote | undefined;
    },
    saveNote(note) {
      const now = note.updatedAt || new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, content, tags, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          tags = excluded.tags,
          updated_at = excluded.updated_at,
          synced = excluded.synced
      `).run(note.id, note.title, note.content, JSON.stringify(note.tags), now, note.synced ? 1 : 0);
    },
    deleteNote(id: string) {
      db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    },
    getPendingNotes() {
      return db.prepare('SELECT * FROM notes WHERE synced = 0').all() as LocalNote[];
    },
    markSynced(id: string) {
      db.prepare('UPDATE notes SET synced = 1 WHERE id = ?').run(id);
    },
    clearAll() {
      db.prepare('DELETE FROM notes').run();
    },
  };
}
