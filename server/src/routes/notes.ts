import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { NoteRow } from '../database';

export function createNotesRouter(db: Database.Database, io: SocketIOServer): Router {
  const router = Router();

  router.get('/notes', (_req: Request, res: Response) => {
    const notes = db.prepare(
      'SELECT id, title, content, tags, folder_id, created_at, updated_at FROM notes WHERE deleted = 0 ORDER BY updated_at DESC'
    ).all() as NoteRow[];

    res.json(notes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      tags: JSON.parse(n.tags),
      folderId: n.folder_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      size: Buffer.byteLength(n.content, 'utf-8'),
    })));
  });

  router.get('/notes/:id', (req: Request, res: Response) => {
    const note = db.prepare(
      'SELECT * FROM notes WHERE id = ? AND deleted = 0'
    ).get(req.params.id) as NoteRow | undefined;

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags),
      folderId: note.folder_id,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  });

  router.post('/notes', (req: Request, res: Response) => {
    const { id, title, content, tags, folderId } = req.body;
    const noteId = id || uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO notes (id, title, content, tags, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(noteId, title || 'Untitled', content || '', JSON.stringify(tags || []), folderId || null, now, now);

    const note = { id: noteId, title: title || 'Untitled', content: content || '', tags: tags || [], folderId: folderId || null, createdAt: now, updatedAt: now };
    io.emit('note:updated', note);
    res.status(201).json(note);
  });

  router.put('/notes/:id', (req: Request, res: Response) => {
    const { title, content, tags, folderId } = req.body;
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.id) as NoteRow | undefined;

    if (!existing) {
      db.prepare(
        'INSERT INTO notes (id, title, content, tags, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, title || 'Untitled', content || '', JSON.stringify(tags || []), folderId ?? null, now, now);
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (content !== undefined) { updates.push('content = ?'); params.push(content); }
      if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
      if (folderId !== undefined) { updates.push('folder_id = ?'); params.push(folderId); }
      updates.push('updated_at = ?');
      params.push(now);
      params.push(req.params.id);

      db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id) as NoteRow;
    const result = {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags),
      folderId: note.folder_id,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
    io.emit('note:updated', result);
    res.json(result);
  });

  router.delete('/notes/:id', (req: Request, res: Response) => {
    db.prepare('UPDATE notes SET deleted = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);
    io.emit('note:deleted', { id: req.params.id });
    res.json({ success: true });
  });

  return router;
}
