import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  db: {
    getNotes: () => ipcRenderer.invoke('db:getNotes'),
    getNote: (id: string) => ipcRenderer.invoke('db:getNote', id),
    saveNote: (note: { id: string; title: string; content: string; tags: string[]; updatedAt: string; synced: boolean }) =>
      ipcRenderer.invoke('db:saveNote', note),
    deleteNote: (id: string) => ipcRenderer.invoke('db:deleteNote', id),
    getPendingNotes: () => ipcRenderer.invoke('db:getPendingNotes'),
    markSynced: (id: string) => ipcRenderer.invoke('db:markSynced', id),
    clearCache: () => ipcRenderer.invoke('db:clearCache'),
  },
});
