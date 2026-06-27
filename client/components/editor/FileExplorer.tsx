"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const YJS_WS_URL = "ws://localhost:5000";

// File extension → Monaco language ID
export function langFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", java: "java",
    c: "c", cpp: "cpp", cs: "csharp",
    go: "go", rs: "rust", php: "php",
    html: "html", css: "css", scss: "scss",
    json: "json", md: "markdown", sql: "sql",
    sh: "shell", yaml: "yaml", yml: "yaml",
    xml: "xml", kt: "kotlin", swift: "swift",
  };
  return map[ext] ?? "plaintext";
}

// File icon by extension (emoji, simple but clear)
function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    js: "🟨", jsx: "⚛️", ts: "🔷", tsx: "⚛️",
    py: "🐍", rb: "💎", java: "☕", go: "🐹",
    rs: "🦀", cpp: "⚙️", c: "⚙️", cs: "💜",
    html: "🌐", css: "🎨", scss: "🎨",
    json: "📋", md: "📝", sql: "🗄️",
    sh: "🖥️", yaml: "⚙️", yml: "⚙️",
  };
  return icons[ext] ?? "📄";
}

export interface FileEntry {
  name: string;
  createdAt: number;
}

interface FileExplorerProps {
  roomCode: string;
  activeFile: string | null;
  onFileSelect: (file: FileEntry) => void;
  onFilesChange?: (files: FileEntry[]) => void;
}

export default function FileExplorer({
  roomCode,
  activeFile,
  onFileSelect,
  onFilesChange,
}: FileExplorerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Shared Yjs map — keyed by filename, value is { name, createdAt }
  // All clients in the same room share this map via the Yjs server.
  const yMapRef = useRef<Y.Map<FileEntry> | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      YJS_WS_URL,
      `${roomCode}:__files__`,  // separate doc from the code docs
      doc
    );
    providerRef.current = provider;

    const yMap = doc.getMap<FileEntry>("files");
    yMapRef.current = yMap;

    const sync = () => {
      const list = Array.from(yMap.values()).sort(
        (a, b) => a.createdAt - b.createdAt
      );
      setFiles(list);
      onFilesChange?.(list);
    };

    yMap.observe(sync);
    sync();

    // Seed a default file if the room is brand new (empty file list)
    provider.on("sync", (synced: boolean) => {
      if (synced && yMap.size === 0) {
        const entry: FileEntry = { name: "main.js", createdAt: Date.now() };
        yMap.set("main.js", entry);
      }
    });

    return () => {
      yMap.unobserve(sync);
      provider.destroy();
      doc.destroy();
    };
  }, [roomCode]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setError("Enter a file name.");
    if (!/\.[a-zA-Z0-9]+$/.test(name))
      return setError("Include a file extension (e.g. main.py).");
    if (yMapRef.current?.has(name))
      return setError("A file with that name already exists.");

    const entry: FileEntry = { name, createdAt: Date.now() };
    yMapRef.current?.set(name, entry);
    setCreating(false);
    setNewName("");
    setError("");
    onFileSelect(entry);
  }

  function handleDelete(name: string) {
    yMapRef.current?.delete(name);
    setConfirmDelete(null);
    // If we deleted the active file, select the first remaining one
    if (name === activeFile) {
      const remaining = Array.from(yMapRef.current?.values() ?? []);
      if (remaining.length > 0) onFileSelect(remaining[0]);
    }
  }

  return (
    <div className="flex h-full w-52 flex-shrink-0 flex-col border-r border-white/10 bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-white/10">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Files
        </span>
        <button
          onClick={() => { setCreating(true); setError(""); }}
          title="New file"
          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-emerald-400 transition text-base leading-none"
        >
          +
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((f) => (
          <div
            key={f.name}
            className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition ${
              f.name === activeFile
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => onFileSelect(f)}
          >
            <span className="text-sm">{fileIcon(f.name)}</span>
            <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
            {confirmDelete === f.name ? (
              <div className="flex gap-1 text-[10px]">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(f.name); }}
                  className="text-red-400 hover:text-red-300"
                >
                  del
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(f.name); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition text-xs"
                title="Delete file"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* New file input */}
        {creating && (
          <form onSubmit={handleCreate} className="px-3 py-1.5">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              placeholder="filename.ext"
              className="w-full rounded bg-white/10 px-2 py-1 font-mono text-xs text-white outline-none focus:ring-1 focus:ring-emerald-400"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setCreating(false); setNewName(""); setError(""); }
              }}
            />
            {error && (
              <p className="mt-1 text-[10px] text-red-400">{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}