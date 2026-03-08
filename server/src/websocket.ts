import { Server as SocketIOServer, Socket } from 'socket.io';
import Database from 'better-sqlite3';
import { NoteRow } from './database';

export interface WebSocketState {
  getClientCount: () => number;
}

export function setupWebSocket(io: SocketIOServer, apiKey: string, db: Database.Database): WebSocketState {
  let clientCount = 0;

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token === apiKey) {
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    clientCount++;
    io.emit('clients:count', clientCount);
    console.log(`Client connected (${clientCount} total)`);

    socket.on('note:save', (data: { id: string; title: string; content: string; tags: string[] }) => {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id FROM notes WHERE id = ?').get(data.id) as NoteRow | undefined;

      if (!existing) {
        db.prepare(
          'INSERT INTO notes (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(data.id, data.title, data.content, JSON.stringify(data.tags || []), now, now);
      } else {
        db.prepare(
          'UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?'
        ).run(data.title, data.content, JSON.stringify(data.tags || []), now, data.id);
      }

      socket.broadcast.emit('note:updated', {
        id: data.id,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        updatedAt: now,
      });
    });

    socket.on('note:subscribe', (noteId: string) => {
      socket.join(`note:${noteId}`);
    });

    socket.on('disconnect', () => {
      clientCount--;
      io.emit('clients:count', clientCount);
      console.log(`Client disconnected (${clientCount} total)`);
    });
  });

  return {
    getClientCount: () => clientCount,
  };
}
