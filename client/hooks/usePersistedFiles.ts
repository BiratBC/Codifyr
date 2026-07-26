"use client";

import { useCallback, useEffect, useRef } from "react";
import { FileEntry } from "@/components/editor/FileExplorer";
import { langFromFilename } from "@/components/editor/FileExplorer";

// Debounce helper — only calls fn after `delay` ms of no new calls
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

interface UsePersistedFilesOptions {
  roomCode: string;
  onLoad?: (files: { name: string; content: string }[]) => void;
}

export function usePersistedFiles({ roomCode, onLoad }: UsePersistedFilesOptions) {
  const loadedRef = useRef(false);

  // Load files from Supabase on first mount
  useEffect(() => {
    if (loadedRef.current || !roomCode) return;
    loadedRef.current = true;

    fetch(`/api/files?roomCode=${roomCode}`)
      .then((r) => r.json())
      .then(({ files }) => {
        if (files?.length > 0) {
          onLoad?.(files);
        }
      })
      .catch(console.error);
  }, [roomCode, onLoad]);

  // Save a file to Supabase (debounced — waits 2s after last keystroke)
  const saveFile = useCallback(
    debounce((filename: string, content: string) => {
      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          filename,
          language: langFromFilename(filename),
          content,
        }),
      }).catch(console.error);
    }, 2000),
    [roomCode]
  );

  // Delete a file from Supabase
  const deleteFile = useCallback(
    (filename: string) => {
      fetch(`/api/files?roomCode=${roomCode}&filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      }).catch(console.error);
    },
    [roomCode]
  );

  // Register a new file in Supabase immediately (with empty content)
  const createFile = useCallback(
    (filename: string) => {
      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          filename,
          language: langFromFilename(filename),
          content: "",
        }),
      }).catch(console.error);
    },
    [roomCode]
  );

  return { saveFile, deleteFile, createFile };
}