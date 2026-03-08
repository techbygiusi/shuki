import React, { useState, useCallback, useMemo } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useStore } from '../store/useStore';
import { Note } from '../types';

interface Props {
  note: Note;
  onChange: (id: string, updates: Partial<Note>) => void;
}

export default function Editor({ note, onChange }: Props) {
  const { editorMode, setEditorMode, settings, serverStatus } = useStore();

  const wordCount = useMemo(() => {
    const words = note.content.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [note.content]);

  const charCount = note.content.length;

  const handleContentChange = useCallback(
    (value?: string) => {
      onChange(note.id, { content: value || '' });
    },
    [note.id, onChange]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(note.id, { title: e.target.value });
    },
    [note.id, onChange]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (files.length === 0) return;
      e.preventDefault();

      for (const file of files) {
        const base64 = await fileToBase64(file);
        const imgMd = `![${file.name}](${base64})\n`;
        onChange(note.id, { content: note.content + imgMd });
      }
    },
    [note.id, note.content, onChange]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((i) => i.type.startsWith('image/'));
      if (!imageItem) return;

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;

      const base64 = await fileToBase64(file);
      const imgMd = `![pasted-image](${base64})\n`;
      onChange(note.id, { content: note.content + imgMd });
    },
    [note.id, note.content, onChange]
  );

  const previewMode = editorMode === 'preview' ? 'preview' : editorMode === 'edit' ? 'edit' : 'live';

  return (
    <div className="flex flex-col h-full fade-in" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {/* Title bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
      >
        <input
          type="text"
          value={note.title}
          onChange={handleTitleChange}
          className="flex-1 text-xl font-display font-bold bg-transparent outline-none"
          style={{ color: 'var(--text-primary)' }}
          placeholder="Note title..."
        />
        <div className="flex items-center gap-2">
          {(['edit', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setEditorMode(mode)}
              className="px-3 py-1 rounded-btn text-xs font-medium transition-all"
              style={{
                backgroundColor: editorMode === mode ? '#F5C842' : 'transparent',
                color: editorMode === mode ? '#1A1A1A' : 'var(--text-secondary)',
              }}
            >
              {mode === 'edit' ? 'Edit' : mode === 'preview' ? 'Preview' : 'Split'}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden" onPaste={handlePaste}>
        <MDEditor
          value={note.content}
          onChange={handleContentChange}
          preview={previewMode}
          height="100%"
          visibleDragbar={false}
          style={{
            height: '100%',
            fontSize: settings.fontSize,
            backgroundColor: 'var(--bg-card)',
          }}
          data-color-mode={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
        />
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-6 py-2 text-xs border-t"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: note.synced
                ? '#22c55e'
                : serverStatus.connected
                ? '#f59e0b'
                : '#ef4444',
            }}
          />
          <span>
            {note.synced
              ? 'Saved & synced'
              : serverStatus.connected
              ? 'Saving...'
              : 'Offline — saved locally'}
          </span>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
