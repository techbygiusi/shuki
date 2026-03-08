export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface ServerConfig {
  url: string;
  apiKey: string;
}

export interface ServerStatus {
  connected: boolean;
  clients: number;
  storage: {
    free: number;
    total: number;
    path: string;
  };
  lastSync: string | null;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  autoSaveInterval: number;
  serverUrl: string;
  apiKey: string;
  offlineOnly: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      db: {
        getNotes: () => Promise<Array<{
          id: string; title: string; content: string; tags: string;
          created_at: string; updated_at: string; synced: number;
        }>>;
        getNote: (id: string) => Promise<{
          id: string; title: string; content: string; tags: string;
          created_at: string; updated_at: string; synced: number;
        } | undefined>;
        saveNote: (note: { id: string; title: string; content: string; tags: string[]; updatedAt: string; synced: boolean }) => Promise<boolean>;
        deleteNote: (id: string) => Promise<boolean>;
        getPendingNotes: () => Promise<Array<{
          id: string; title: string; content: string; tags: string;
          created_at: string; updated_at: string; synced: number;
        }>>;
        markSynced: (id: string) => Promise<boolean>;
        clearCache: () => Promise<boolean>;
      };
    };
  }
}
