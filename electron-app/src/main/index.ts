import { app, BrowserWindow, ipcMain, nativeTheme, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { initLocalDb, LocalDatabase } from './localDb';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let localDb: LocalDatabase;

function getThemeBg(): string {
  const settings = store.get('settings') as Record<string, unknown> | undefined;
  const theme = settings?.theme as string | undefined;
  const isDark = theme === 'dark' || (theme !== 'light' && nativeTheme.shouldUseDarkColors);
  return isDark ? '#1C1814' : '#F7F3EE';
}

function createWindow() {
  const bounds = store.get('windowBounds') as { width?: number; height?: number; x?: number; y?: number } | undefined;

  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1280,
    height: bounds?.height || 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    backgroundColor: getThemeBg(),
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const b = mainWindow.getBounds();
      store.set('windowBounds', { width: b.width, height: b.height, x: b.x, y: b.y });
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getImagesPath(): string {
  const imagesDir = path.join(app.getPath('userData'), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

app.whenReady().then(async () => {
  protocol.registerFileProtocol('shuki', (request, callback) => {
    const url = request.url.replace('shuki://', '');
    const decodedPath = decodeURIComponent(url);
    callback({ path: decodedPath });
  });

  localDb = await initLocalDb(app.getPath('userData'));
  createWindow();

  // Store
  ipcMain.handle('store:get', (_e, key: string) => store.get(key));
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => store.set(key, value));
  ipcMain.handle('store:delete', (_e, key: string) => store.delete(key));

  // Notes
  ipcMain.handle('db:getNotes', () => localDb.getAllNotes());
  ipcMain.handle('db:getNote', (_e, id: string) => localDb.getNote(id));
  ipcMain.handle('db:saveNote', (_e, note: { id: string; title: string; content: string; tags: string[]; folderId?: string | null; updatedAt: string; synced: boolean }) => {
    localDb.saveNote(note);
    return true;
  });
  ipcMain.handle('db:deleteNote', (_e, id: string) => {
    localDb.deleteNote(id);
    return true;
  });
  ipcMain.handle('db:getPendingNotes', () => localDb.getPendingNotes());
  ipcMain.handle('db:markSynced', (_e, id: string) => {
    localDb.markSynced(id);
    return true;
  });
  ipcMain.handle('db:clearCache', () => {
    localDb.clearAll();
    return true;
  });

  // Folders
  ipcMain.handle('db:getFolders', () => localDb.getAllFolders());
  ipcMain.handle('db:saveFolder', (_e, folder: { id: string; name: string; sortOrder: number; synced: boolean }) => {
    localDb.saveFolder(folder);
    return true;
  });
  ipcMain.handle('db:deleteFolder', (_e, id: string) => {
    localDb.deleteFolder(id);
    return true;
  });
  ipcMain.handle('db:markFolderSynced', (_e, id: string) => {
    localDb.markFolderSynced(id);
    return true;
  });

  // Sync Queue
  ipcMain.handle('db:addToSyncQueue', (_e, action: string, entityType: string, entityId: string, payload: string) => {
    localDb.addToSyncQueue(action, entityType, entityId, payload);
    return true;
  });
  ipcMain.handle('db:getSyncQueue', () => localDb.getSyncQueue());
  ipcMain.handle('db:removeSyncQueueItem', (_e, id: number) => {
    localDb.removeSyncQueueItem(id);
    return true;
  });
  ipcMain.handle('db:clearSyncQueue', () => {
    localDb.clearSyncQueue();
    return true;
  });

  // Images
  ipcMain.handle('images:save', async (_e, buffer: ArrayBuffer, filename: string) => {
    const imagesDir = getImagesPath();
    const filePath = path.join(imagesDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  });
  ipcMain.handle('images:getPath', () => getImagesPath());
  ipcMain.handle('images:list', () => {
    const imagesDir = getImagesPath();
    if (!fs.existsSync(imagesDir)) return [];
    return fs.readdirSync(imagesDir).filter(f => /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(f));
  });
  ipcMain.handle('images:delete', (_e, filename: string) => {
    const filePath = path.join(getImagesPath(), path.basename(filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  });
  ipcMain.handle('images:read', (_e, filename: string) => {
    const filePath = path.join(getImagesPath(), path.basename(filename));
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
