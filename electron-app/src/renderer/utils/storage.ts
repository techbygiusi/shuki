import { Note, AppSettings } from '../types';

const api = window.electronAPI;

// Fallback for browser/web dev mode
const memStore: Record<string, unknown> = {};
const memNotes: Map<string, Note & { synced: boolean }> = new Map();

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
      updatedAt: note.updatedAt,
      synced: note.synced,
    });
  } else {
    memNotes.set(note.id, { ...note, synced: note.synced });
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
  }
}
