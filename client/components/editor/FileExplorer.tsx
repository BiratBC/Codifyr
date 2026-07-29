"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const YJS_WS_URL = "ws://localhost:5000";

// ── Language detection ────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FileEntry {
  name: string;
  path: string;       // full path e.g. "src/utils/helpers.ts"
  isFolder: boolean;
  createdAt: number;
}

interface ContextMenu {
  x: number;
  y: number;
  target: FileEntry | null; // null = background (root level)
}

import { PersistedFile } from "@/hooks/usePersistedFiles";

interface FileExplorerProps {
  roomCode: string;
  activeFile: string | null;       // full path
  persistedFiles?: PersistedFile[];
  onFileSelect: (file: FileEntry) => void;
  onFilesChange?: (files: FileEntry[]) => void;
  onFileDelete?: (path: string) => void;
  onFileCreate?: (path: string) => void;
  onFolderCreate?: (path: string) => void;
  onFolderDelete?: (path: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FileExplorer({
  roomCode,
  activeFile,
  persistedFiles,
  onFileSelect,
  onFilesChange,
  onFileDelete,
  onFileCreate,
  onFolderCreate,
  onFolderDelete,
}: FileExplorerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; isFolder: boolean } | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const yMapRef = useRef<Y.Map<FileEntry> | null>(null);

  // ── Yjs sync ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(YJS_WS_URL, `${roomCode}:__files__`, doc);
    const yMap = doc.getMap<FileEntry>("files");
    yMapRef.current = yMap;

    const sync = () => {
      const list = Array.from(yMap.values()).sort((a, b) => {
        // Folders first, then alphabetical
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
      setEntries(list);
      onFilesChange?.(list);
    };

    yMap.observe(sync);
    sync();

    return () => {
      yMap.unobserve(sync);
      provider.destroy();
      doc.destroy();
    };
  }, [roomCode]);

  // Seed Yjs map with files loaded from Supabase DB
  useEffect(() => {
    const yMap = yMapRef.current;
    if (!yMap || !persistedFiles || persistedFiles.length === 0) return;

    persistedFiles.forEach((pf) => {
      const path = pf.path;
      if (!path) return;

      // Seed parent folder paths if missing
      const parts = path.split("/");
      const filename = parts.pop()!;
      let currentParent = "";

      for (const folderName of parts) {
        const folderPath = currentParent ? `${currentParent}/${folderName}` : folderName;
        if (!yMap.has(folderPath)) {
          yMap.set(folderPath, {
            name: folderName,
            path: folderPath,
            isFolder: true,
            createdAt: Date.now(),
          });
        }
        currentParent = folderPath;
      }

      // Seed file entry if missing
      if (!yMap.has(path)) {
        yMap.set(path, {
          name: filename,
          path,
          isFolder: false,
          createdAt: Date.now(),
        });
      }
    });
  }, [persistedFiles]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // ── Close context menu on outside click ───────────────────────────────────
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleCollapse(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, target: FileEntry | null) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  }

  function startCreating(parentPath: string, isFolder: boolean) {
    setCreating({ parentPath, isFolder });
    setNewName("");
    setError("");
    setContextMenu(null);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!creating) return;

    const name = newName.trim();
    if (!name) return setError("Enter a name.");

    if (!creating.isFolder && !/\.[a-zA-Z0-9]+$/.test(name)) {
      return setError("Include a file extension (e.g. main.py).");
    }

    const path = creating.parentPath ? `${creating.parentPath}/${name}` : name;

    if (yMapRef.current?.has(path)) {
      return setError("Already exists.");
    }

    const entry: FileEntry = {
      name,
      path,
      isFolder: creating.isFolder,
      createdAt: Date.now(),
    };
    yMapRef.current?.set(path, entry);

    setCreating(null);
    setNewName("");
    setError("");

    if (creating.isFolder) {
      onFolderCreate?.(path);
    } else {
      onFileCreate?.(path);
      onFileSelect(entry);
    }
  }

  function handleDelete(entry: FileEntry) {
    const yMap = yMapRef.current;
    if (!yMap) return;

    if (entry.isFolder) {
      onFolderDelete?.(entry.path);
    }

    // Delete the entry and all children (for folders)
    const toDelete = Array.from(yMap.keys()).filter(
      (k) => k === entry.path || k.startsWith(entry.path + "/")
    );
    toDelete.forEach((k) => {
      yMap.delete(k);
      if (k !== entry.path || !entry.isFolder) {
        onFileDelete?.(k);
      }
    });

    // If deleted file was active, clear selection
    if (!entry.isFolder && entry.path === activeFile) {
      const remaining = Array.from(yMap.values()).filter((e) => !e.isFolder);
      if (remaining.length > 0) onFileSelect(remaining[0]);
    }
    setContextMenu(null);
  }

  // ── Render tree ────────────────────────────────────────────────────────────
  function renderTree(parentPath: string, depth: number): React.ReactNode {
    const children = entries.filter((e) => {
      const parts = e.path.split("/");
      const parentParts = parentPath ? parentPath.split("/") : [];
      return (
        parts.length === parentParts.length + 1 &&
        (parentPath === "" || e.path.startsWith(parentPath + "/"))
      );
    });

    return children.map((entry) => {
      const isActive = !entry.isFolder && entry.path === activeFile;
      const isCollapsed = collapsed.has(entry.path);

      return (
        <div key={entry.path}>
          {/* Row */}
          <div
            className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none transition rounded-sm mx-1 ${
              isActive
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => {
              if (entry.isFolder) toggleCollapse(entry.path);
              else onFileSelect(entry);
            }}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            {entry.isFolder ? (
              <>
                <span className="text-xs text-zinc-500 w-3">
                  {isCollapsed ? "▶" : "▼"}
                </span>
                <span className="text-sm">📁</span>
              </>
            ) : (
              <>
                <span className="w-3" />
                <span className="text-sm">{fileIcon(entry.name)}</span>
              </>
            )}
            <span className="flex-1 truncate font-mono text-xs">
              {entry.name}
            </span>
          </div>

          {/* Children */}
          {entry.isFolder && !isCollapsed && (
            <div>
              {renderTree(entry.path, depth + 1)}
              {/* Inline create input inside this folder */}
              {creating?.parentPath === entry.path && renderCreateInput(depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  function renderCreateInput(depth: number) {
    return (
      <form
        onSubmit={handleCreate}
        className="px-2 py-1 mx-1"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <input
          ref={inputRef}
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setError(""); }}
          placeholder={creating?.isFolder ? "folder-name" : "filename.ext"}
          className="w-full rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white outline-none focus:ring-1 focus:ring-emerald-400"
          onKeyDown={(e) => {
            if (e.key === "Escape") { setCreating(null); setError(""); }
          }}
          onBlur={() => { setCreating(null); setError(""); }}
        />
        {error && <p className="mt-0.5 text-[10px] text-red-400">{error}</p>}
      </form>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full w-52 flex-shrink-0 flex-col border-r border-white/10 bg-[#0d0d0d]"
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Header */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-white/10">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCreating("", false)}
            title="New File"
            className="rounded p-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            📄+
          </button>
          <button
            onClick={() => startCreating("", true)}
            title="New Folder"
            className="rounded p-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            📁+
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {entries.length === 0 && !creating ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="font-mono text-xs text-zinc-500">
              This workspace is empty.
            </p>

            <div className="flex flex-col gap-2 w-full max-w-[140px]">
              <button
                onClick={() => startCreating("", false)}
                className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <span>📄</span> New File
              </button>

              <button
                onClick={() => startCreating("", true)}
                className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                <span>📁</span> New Folder
              </button>
            </div>
          </div>
        ) : (
          renderTree("", 0)
        )}

        {creating?.parentPath === "" && renderCreateInput(0)}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#1a1a1a] py-1 shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* New file / folder in current context */}
          <button
            className="w-full px-3 py-1.5 text-left font-mono text-xs text-zinc-300 hover:bg-white/10"
            onClick={() => startCreating(
              contextMenu.target?.isFolder ? contextMenu.target.path :
              contextMenu.target ? contextMenu.target.path.split("/").slice(0, -1).join("/") : "",
              false
            )}
          >
            📄 New File
          </button>
          <button
            className="w-full px-3 py-1.5 text-left font-mono text-xs text-zinc-300 hover:bg-white/10"
            onClick={() => startCreating(
              contextMenu.target?.isFolder ? contextMenu.target.path :
              contextMenu.target ? contextMenu.target.path.split("/").slice(0, -1).join("/") : "",
              true
            )}
          >
            📁 New Folder
          </button>

          {/* Delete — only if right-clicked on an entry */}
          {contextMenu.target && (
            <>
              <div className="my-1 border-t border-white/10" />
              <button
                className="w-full px-3 py-1.5 text-left font-mono text-xs text-red-400 hover:bg-white/10"
                onClick={() => handleDelete(contextMenu.target!)}
              >
                🗑 Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}