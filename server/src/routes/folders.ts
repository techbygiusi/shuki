import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { FolderRow } from '../database';

export function createFoldersRouter(db: Database.Database, io: SocketIOServer): Router {
  const router = Router();

  router.get('/folders', (_req: Request, res: Response) => {
    const folders = db.prepare(
      'SELECT id, name, sort_order, created_at, updated_at FROM folders WHERE deleted = 0 ORDER BY sort_order ASC'
    ).all() as FolderRow[];

    res.json(folders.map(f => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sort_order,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })));
  });

  router.post('/folders', (req: Request, res: Response) => {
    const { id, name, sortOrder } = req.body;
    const folderId = id || uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(folderId, name || 'Untitled Folder', sortOrder ?? 0, now, now);

    const folder = { id: folderId, name: name || 'Untitled Folder', sortOrder: sortOrder ?? 0, createdAt: now, updatedAt: now };
    io.emit('folder:updated', folder);
    res.status(201).json(folder);
  });

  router.put('/folders/:id', (req: Request, res: Response) => {
    const { name, sortOrder } = req.body;
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM folders WHERE id = ?').get(req.params.id) as FolderRow | undefined;

    if (!existing) {
      db.prepare(
        'INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(req.params.id, name || 'Untitled Folder', sortOrder ?? 0, now, now);
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder); }
      updates.push('updated_at = ?');
      params.push(now);
      params.push(req.params.id);
      db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id) as FolderRow;
    const result = {
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sort_order,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    };
    io.emit('folder:updated', result);
    res.json(result);
  });

  router.delete('/folders/:id', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    // Unassign notes from this folder (don't delete them)
    db.prepare('UPDATE notes SET folder_id = NULL, updated_at = ? WHERE folder_id = ?').run(now, req.params.id);
    // Soft delete folder
    db.prepare('UPDATE folders SET deleted = 1, updated_at = ? WHERE id = ?').run(now, req.params.id);
    io.emit('folder:deleted', { id: req.params.id });
    res.json({ success: true });
  });

  return router;
}
