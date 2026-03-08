import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import { execSync } from 'child_process';
import { WebSocketState } from '../websocket';

function getDiskSpace(dirPath: string): { free: number; total: number } {
  try {
    // Use df command for cross-platform disk info
    const output = execSync(`df -k "${dirPath}" | tail -1`, { encoding: 'utf-8' });
    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    return { free, total };
  } catch {
    return { free: 0, total: 0 };
  }
}

export function createHealthRouter(db: Database.Database, wsState: WebSocketState, dataPath: string): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const disk = getDiskSpace(dataPath);
    res.json({
      status: 'ok',
      version: '1.0.0',
      clients: wsState.getClientCount(),
      storage: {
        free: disk.free,
        total: disk.total,
        path: dataPath,
      },
    });
  });

  router.get('/stats', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM notes WHERE deleted = 0').get() as { count: number };
    const sizeRow = db.prepare('SELECT COALESCE(SUM(LENGTH(content)), 0) as total FROM notes WHERE deleted = 0').get() as { total: number };
    const disk = getDiskSpace(dataPath);

    res.json({
      notesCount: countRow.count,
      totalSize: sizeRow.total,
      freeDisk: disk.free,
      storagePath: dataPath,
      connectedClients: wsState.getClientCount(),
    });
  });

  return router;
}
