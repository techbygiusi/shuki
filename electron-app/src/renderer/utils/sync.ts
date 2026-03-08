import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { Note } from '../types';

let apiClient: AxiosInstance | null = null;
let socket: Socket | null = null;

export function initApi(serverUrl: string, apiKey: string): AxiosInstance {
  apiClient = axios.create({
    baseURL: serverUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 10000,
  });
  return apiClient;
}

export function getApi(): AxiosInstance | null {
  return apiClient;
}

export function initSocket(
  serverUrl: string,
  apiKey: string,
  onNoteUpdated: (note: Note) => void,
  onNoteDeleted: (data: { id: string }) => void,
  onClientsCount: (count: number) => void
): Socket {
  if (socket) socket.disconnect();

  socket = io(serverUrl, {
    auth: { token: apiKey },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  socket.on('note:updated', onNoteUpdated);
  socket.on('note:deleted', onNoteDeleted);
  socket.on('clients:count', onClientsCount);

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export async function checkServerHealth(serverUrl: string, apiKey: string): Promise<{
  ok: boolean;
  data?: { status: string; clients: number; storage: { free: number; total: number; path: string }; version: string };
}> {
  try {
    const res = await axios.get(`${serverUrl}/api/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });
    return { ok: true, data: res.data };
  } catch {
    return { ok: false };
  }
}

export async function fetchNotes(api: AxiosInstance): Promise<Note[]> {
  const res = await api.get('/api/notes');
  return res.data.map((n: Record<string, unknown>) => ({
    id: n.id as string,
    title: n.title as string,
    content: n.content as string,
    tags: (n.tags as string[]) || [],
    createdAt: n.createdAt as string,
    updatedAt: n.updatedAt as string,
    synced: true,
  }));
}

export async function syncNote(api: AxiosInstance, note: Note): Promise<Note> {
  const res = await api.put(`/api/notes/${note.id}`, {
    title: note.title,
    content: note.content,
    tags: note.tags,
  });
  return { ...res.data, synced: true };
}

export async function createNoteOnServer(api: AxiosInstance, note: Note): Promise<Note> {
  const res = await api.post('/api/notes', {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
  });
  return { ...res.data, synced: true };
}

export async function deleteNoteOnServer(api: AxiosInstance, id: string): Promise<void> {
  await api.delete(`/api/notes/${id}`);
}
