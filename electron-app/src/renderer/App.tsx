import React, { useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { loadSettings, saveSettings, loadNotesFromLocal, saveNoteLocal, deleteNoteLocal, getPendingNotes, markNoteSynced } from './utils/storage';
import { initApi, initSocket, checkServerHealth, fetchNotes, syncNote, disconnectSocket, getApi } from './utils/sync';
import { applyTheme, watchSystemTheme } from './utils/theme';
import Onboarding from './components/Onboarding';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Settings from './components/Settings';
import { Note } from './types';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function App() {
  const {
    settings, setSettings, isOnboarding, setIsOnboarding,
    notes, setNotes, addNote, updateNote, removeNote,
    activeNoteId, setActiveNoteId, showSettings, setShowSettings,
    setServerStatus, editorMode, setEditorMode,
  } = useStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved.serverUrl || saved.offlineOnly) {
        setSettings(saved);
        setIsOnboarding(false);
      }
      if (saved.theme) applyTheme(saved.theme);
    })();
  }, []);

  // Apply theme changes
  useEffect(() => {
    applyTheme(settings.theme);
    const cleanup = watchSystemTheme(() => {
      if (settings.theme === 'system') applyTheme('system');
    });
    return cleanup;
  }, [settings.theme]);

  // Load local notes
  useEffect(() => {
    if (!isOnboarding) {
      loadNotesFromLocal().then((localNotes) => {
        setNotes(localNotes);
      });
    }
  }, [isOnboarding]);

  // Connect to server
  useEffect(() => {
    if (isOnboarding || settings.offlineOnly || !settings.serverUrl) return;

    const api = initApi(settings.serverUrl, settings.apiKey);

    // Fetch server notes and merge
    fetchNotes(api)
      .then((serverNotes) => {
        loadNotesFromLocal().then((localNotes) => {
          const merged = mergeNotes(localNotes, serverNotes);
          setNotes(merged);
          merged.forEach((n) => saveNoteLocal(n));
          setServerStatus({ connected: true, lastSync: new Date().toISOString() });
        });
      })
      .catch(() => {
        setServerStatus({ connected: false });
      });

    // WebSocket
    const sock = initSocket(
      settings.serverUrl,
      settings.apiKey,
      (note: Note) => {
        updateNote(note.id, note);
        saveNoteLocal({ ...note, synced: true });
      },
      (data: { id: string }) => {
        removeNote(data.id);
        deleteNoteLocal(data.id);
      },
      (count: number) => {
        setServerStatus({ clients: count });
      }
    );

    sock.on('connect', () => setServerStatus({ connected: true }));
    sock.on('disconnect', () => setServerStatus({ connected: false }));

    // Health check interval
    const healthInterval = setInterval(async () => {
      const result = await checkServerHealth(settings.serverUrl, settings.apiKey);
      setServerStatus({
        connected: result.ok,
        ...(result.data ? {
          clients: result.data.clients,
          storage: result.data.storage,
        } : {}),
      });

      // Sync pending notes when reconnected
      if (result.ok) {
        syncPendingNotes();
      }
    }, 30000);

    return () => {
      clearInterval(healthInterval);
      disconnectSocket();
    };
  }, [isOnboarding, settings.serverUrl, settings.apiKey, settings.offlineOnly]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      } else if (mod && e.key === 's') {
        e.preventDefault();
        handleForceSave();
      } else if (mod && e.key === 'f') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      } else if (mod && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setEditorMode(editorMode === 'preview' ? 'split' : 'preview');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorMode]);

  const handleNewNote = useCallback(() => {
    const note: Note = {
      id: generateId(),
      title: 'Untitled',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    addNote(note);
    saveNoteLocal(note);
    setActiveNoteId(note.id);
  }, []);

  const handleNoteChange = useCallback((id: string, updates: Partial<Note>) => {
    const now = new Date().toISOString();
    updateNote(id, { ...updates, updatedAt: now, synced: false });

    // Debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const state = useStore.getState();
      const note = state.notes.find((n) => n.id === id);
      if (!note) return;

      const updated = { ...note, ...updates, updatedAt: now, synced: false };
      await saveNoteLocal(updated);

      // Try server sync
      const api = getApi();
      if (api && !settings.offlineOnly) {
        try {
          await syncNote(api, updated);
          updateNote(id, { synced: true });
          await saveNoteLocal({ ...updated, synced: true });
          setServerStatus({ lastSync: new Date().toISOString() });
        } catch {
          // Will be synced later by background sync
        }
      }
    }, settings.autoSaveInterval);
  }, [settings.autoSaveInterval, settings.offlineOnly]);

  const handleDeleteNote = useCallback(async (id: string) => {
    removeNote(id);
    await deleteNoteLocal(id);
    const api = getApi();
    if (api && !settings.offlineOnly) {
      try {
        await api.delete(`/api/notes/${id}`);
      } catch {
        // Already deleted locally
      }
    }
  }, [settings.offlineOnly]);

  const handleForceSave = useCallback(async () => {
    syncPendingNotes();
    toast.success('Sync triggered');
  }, []);

  async function syncPendingNotes() {
    const api = getApi();
    if (!api || settings.offlineOnly) return;

    const pending = await getPendingNotes();
    for (const note of pending) {
      try {
        await syncNote(api, note);
        await markNoteSynced(note.id);
        updateNote(note.id, { synced: true });
      } catch {
        // Will retry next cycle
      }
    }
    if (pending.length > 0) {
      setServerStatus({ lastSync: new Date().toISOString() });
    }
  }

  const handleOnboardingComplete = useCallback(async (config: { serverUrl: string; apiKey: string; offlineOnly: boolean }) => {
    const newSettings = { ...settings, ...config };
    setSettings(newSettings);
    await saveSettings(newSettings);
    setIsOnboarding(false);
  }, [settings]);

  if (isOnboarding) {
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (showSettings) {
    return (
      <>
        <Settings onClose={() => setShowSettings(false)} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Sidebar
        onNewNote={handleNewNote}
        onDeleteNote={handleDeleteNote}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeNote ? (
          <Editor
            note={activeNote}
            onChange={handleNoteChange}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center fade-in">
              <div className="text-5xl mb-4">&#128221;</div>
              <p className="text-lg font-display">Select a note or create a new one</p>
              <p className="text-sm mt-2">Ctrl/Cmd + N to create a new note</p>
            </div>
          </div>
        )}
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          },
        }}
      />
    </div>
  );
}

function mergeNotes(local: Note[], server: Note[]): Note[] {
  const map = new Map<string, Note>();
  for (const n of local) map.set(n.id, n);
  for (const n of server) {
    const existing = map.get(n.id);
    if (!existing || new Date(n.updatedAt) >= new Date(existing.updatedAt)) {
      map.set(n.id, { ...n, synced: true });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
