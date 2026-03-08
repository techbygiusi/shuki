import { create } from 'zustand';
import { Note, AppSettings, ServerStatus, ThemeMode } from '../types';

interface AppState {
  // Notes
  notes: Note[];
  activeNoteId: string | null;
  searchQuery: string;

  // Server
  serverStatus: ServerStatus;
  settings: AppSettings;
  isOnboarding: boolean;
  showSettings: boolean;

  // UI
  editorMode: 'edit' | 'preview' | 'split';
  sidebarWidth: number;

  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;
  setActiveNoteId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setServerStatus: (status: Partial<ServerStatus>) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setIsOnboarding: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setEditorMode: (mode: 'edit' | 'preview' | 'split') => void;

  // Computed-like
  getActiveNote: () => Note | undefined;
  getFilteredNotes: () => Note[];
}

export const useStore = create<AppState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  searchQuery: '',

  serverStatus: {
    connected: false,
    clients: 0,
    storage: { free: 0, total: 0, path: '' },
    lastSync: null,
  },

  settings: {
    theme: 'system',
    fontSize: 16,
    autoSaveInterval: 1500,
    serverUrl: '',
    apiKey: '',
    offlineOnly: false,
  },

  isOnboarding: true,
  showSettings: false,
  editorMode: 'split',
  sidebarWidth: 280,

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeNote: (id) =>
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    })),
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setServerStatus: (status) =>
    set((s) => ({ serverStatus: { ...s.serverStatus, ...status } })),
  setSettings: (settings) =>
    set((s) => ({ settings: { ...s.settings, ...settings } })),
  setIsOnboarding: (v) => set({ isOnboarding: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setEditorMode: (mode) => set({ editorMode: mode }),

  getActiveNote: () => {
    const s = get();
    return s.notes.find((n) => n.id === s.activeNoteId);
  },
  getFilteredNotes: () => {
    const s = get();
    if (!s.searchQuery.trim()) return s.notes;
    const q = s.searchQuery.toLowerCase();
    return s.notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  },
}));
