import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initDatabase } from './database';
import { createNotesRouter } from './routes/notes';
import { createImagesRouter } from './routes/images';
import { createHealthRouter } from './routes/health';
import { authMiddleware } from './middleware/auth';
import { setupWebSocket } from './websocket';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_PATH = process.env.DATA_PATH || './data';

const IMAGES_PATH = path.join(DATA_PATH, 'images');
const API_KEY_PATH = path.join(DATA_PATH, 'apikey.txt');

// Ensure directories exist
fs.mkdirSync(IMAGES_PATH, { recursive: true });
fs.mkdirSync(path.join(DATA_PATH, 'notes'), { recursive: true });

// API Key management
function getOrCreateApiKey(): string {
  if (fs.existsSync(API_KEY_PATH)) {
    return fs.readFileSync(API_KEY_PATH, 'utf-8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(API_KEY_PATH, key, 'utf-8');
  return key;
}

const API_KEY = getOrCreateApiKey();

console.log('');
console.log('================================================');
console.log('  NoteSync Server Ready!');
console.log(`  Your API Key: ${API_KEY}`);
console.log('  Add this key to your NoteSync app to connect.');
console.log('================================================');
console.log('');

// Initialize database
const db = initDatabase(DATA_PATH);

// Express setup
const app = express();
const httpServer = createServer(app);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const wsState = setupWebSocket(io, API_KEY, db);

// Health endpoint (no auth required for basic check)
app.use('/api', createHealthRouter(db, wsState, DATA_PATH));

// Auth middleware for all other /api routes
app.use('/api', authMiddleware(API_KEY));

// Routes
app.use('/api', createNotesRouter(db, io));
app.use('/api', createImagesRouter(IMAGES_PATH));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
