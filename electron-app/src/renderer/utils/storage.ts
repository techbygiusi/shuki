import { Note, Folder, AppSettings, SyncQueueItem } from '../types';

const api = window.electronAPI;

const memStore: Record<string, unknown> = {};
const memNotes: Map<string, Note> = new Map();
const memFolders: Map<string, Folder> = new Map();
const memSyncQueue: SyncQueueItem[] = [];

function isElectron(): boolean {
  return !!api;
}

export async function loadSettings(): Promise<Partial<AppSettings>> {
  if (isElectron()) {
    const settings = await api!.store.get('settings');
    return (settings as Partial<AppSettings>) || {};
  }
  return (memStore['settings'] as Partial<AppSettings>) || {};
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  if (isElectron()) {
    const current = (await api!.store.get('settings')) || {};
    await api!.store.set('settings', { ...(current as object), ...settings });
  } else {
    memStore['settings'] = { ...((memStore['settings'] as object) || {}), ...settings };
  }
}

export async function loadNotesFromLocal(): Promise<Note[]> {
  if (isElectron()) {
    const rows = await api!.db.getNotes();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      folderId: r.folder_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: r.synced === 1,
    }));
  }
  return Array.from(memNotes.values());
}

export async function saveNoteLocal(note: Note): Promise<void> {
  if (isElectron()) {
    await api!.db.saveNote({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      folderId: note.folderId,
      updatedAt: note.updatedAt,
      synced: note.synced,
    });
  } else {
    memNotes.set(note.id, note);
  }
}

export async function deleteNoteLocal(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.deleteNote(id);
  } else {
    memNotes.delete(id);
  }
}

export async function getPendingNotes(): Promise<Note[]> {
  if (isElectron()) {
    const rows = await api!.db.getPendingNotes();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      folderId: r.folder_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: false,
    }));
  }
  return Array.from(memNotes.values()).filter((n) => !n.synced);
}

export async function markNoteSynced(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.markSynced(id);
  } else {
    const note = memNotes.get(id);
    if (note) note.synced = true;
  }
}

export async function clearLocalCache(): Promise<void> {
  if (isElectron()) {
    await api!.db.clearCache();
  } else {
    memNotes.clear();
    memFolders.clear();
  }
}

// Folder operations
export async function loadFoldersFromLocal(): Promise<Folder[]> {
  if (isElectron()) {
    const rows = await api!.db.getFolders();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      synced: r.synced === 1,
    }));
  }
  return Array.from(memFolders.values());
}

export async function saveFolderLocal(folder: Folder): Promise<void> {
  if (isElectron()) {
    await api!.db.saveFolder({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      synced: folder.synced,
    });
  } else {
    memFolders.set(folder.id, folder);
  }
}

export async function deleteFolderLocal(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.deleteFolder(id);
  } else {
    memFolders.delete(id);
    // Unassign notes
    for (const note of memNotes.values()) {
      if (note.folderId === id) note.folderId = null;
    }
  }
}

export async function markFolderSynced(id: string): Promise<void> {
  if (isElectron()) {
    await api!.db.markFolderSynced(id);
  } else {
    const folder = memFolders.get(id);
    if (folder) folder.synced = true;
  }
}

// Sync Queue operations
export async function addToSyncQueue(action: string, entityType: string, entityId: string, payload: object): Promise<void> {
  if (isElectron()) {
    await api!.db.addToSyncQueue(action, entityType, entityId, JSON.stringify(payload));
  } else {
    memSyncQueue.push({
      id: Date.now(),
      action,
      entityType,
      entityId,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (isElectron()) {
    const rows = await api!.db.getSyncQueue();
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }
  return [...memSyncQueue];
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  if (isElectron()) {
    await api!.db.removeSyncQueueItem(id);
  } else {
    const idx = memSyncQueue.findIndex((q) => q.id === id);
    if (idx >= 0) memSyncQueue.splice(idx, 1);
  }
}

// Shortcuts
export async function loadShortcuts(): Promise<Record<string, string> | null> {
  if (isElectron()) {
    const shortcuts = await api!.store.get('shortcuts');
    return (shortcuts as Record<string, string>) || null;
  }
  return (memStore['shortcuts'] as Record<string, string>) || null;
}

export async function saveShortcuts(shortcuts: Record<string, string>): Promise<void> {
  if (isElectron()) {
    await api!.store.set('shortcuts', shortcuts);
  } else {
    memStore['shortcuts'] = shortcuts;
  }
}

// Image operations
export async function saveImageLocal(buffer: ArrayBuffer, filename: string): Promise<string> {
  if (isElectron()) {
    return await api!.images.save(buffer, filename);
  }
  return filename;
}

export async function getImagesPath(): Promise<string> {
  if (isElectron()) {
    return await api!.images.getPath();
  }
  return '';
}

export async function listLocalImages(): Promise<string[]> {
  if (isElectron()) {
    return await api!.images.list();
  }
  return [];
}

export async function deleteLocalImage(filename: string): Promise<void> {
  if (isElectron()) {
    await api!.images.delete(filename);
  }
}
