"use client";

import { useCallback, useEffect, useState } from "react";
import { langFromFilename } from "@/components/editor/FileExplorer";

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export interface PersistedFile {
  name: string;
  path: string;
  content: string;
}

export function usePersistedFiles(roomCode: string, username?: string) {
  const [loadedFiles, setLoadedFiles] = useState<PersistedFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Don't run until roomCode is actually available
    if (!roomCode) return;

    console.log("[files] fetching for room:", roomCode);

    fetch(`/api/files?roomCode=${roomCode}`)
      .then((r) => r.json())
      .then(({ files }) => {
        console.log("[files] loaded:", files);
        setLoadedFiles(
          (files ?? []).map((f: any) => ({
            name: f.name,
            path: f.path || f.name,
            content: f.content ?? "",
          }))
        );
        setLoaded(true);
      })
      .catch((err) => {
        console.error("[files] fetch error:", err);
        setLoaded(true);
      });

    // Record member joining
    if (username) {
      fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, username }),
      }).catch(console.error);
    }
  }, [roomCode]); // re-runs if roomCode changes from "" to actual value

  const saveFileNow = useCallback(
    (filePath: string, content: string) => {
      if (!roomCode || !filePath) return;
      setLoadedFiles((prev) => {
        const exists = prev.some((f) => f.path === filePath || f.name === filePath);
        if (exists) {
          return prev.map((f) =>
            f.path === filePath || f.name === filePath ? { ...f, content } : f
          );
        }
        return [...prev, { name: filePath.split("/").pop() ?? filePath, path: filePath, content }];
      });

      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          path: filePath,
          filename: filePath.split("/").pop() ?? filePath,
          language: langFromFilename(filePath),
          content,
        }),
      }).catch(console.error);
    },
    [roomCode]
  );

  const saveFile = useCallback(
    debounce((filePath: string, content: string) => {
      saveFileNow(filePath, content);
    }, 500),
    [saveFileNow]
  );

  const deleteFile = useCallback(
    (filePath: string) => {
      if (!roomCode || !filePath) return;
      fetch(
        `/api/files?roomCode=${roomCode}&path=${encodeURIComponent(filePath)}&filename=${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
        }
      ).catch(console.error);
    },
    [roomCode]
  );

  const createFolder = useCallback(
    (folderPath: string) => {
      if (!roomCode || !folderPath) return;
      fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          path: folderPath,
        }),
      }).catch(console.error);
    },
    [roomCode]
  );

  const deleteFolder = useCallback(
    (folderPath: string) => {
      if (!roomCode || !folderPath) return;
      fetch(`/api/folders?roomCode=${roomCode}&path=${encodeURIComponent(folderPath)}`, {
        method: "DELETE",
      }).catch(console.error);
    },
    [roomCode]
  );

  const createFile = useCallback(
    (filePath: string) => {
      if (!roomCode || !filePath) return;
      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          path: filePath,
          filename: filePath.split("/").pop() ?? filePath,
          language: langFromFilename(filePath),
          content: "",
        }),
      }).catch(console.error);
    },
    [roomCode]
  );

  const getInitialContent = useCallback(
    (filePath: string) => {
      return (
        loadedFiles.find(
          (f) => f.path === filePath || f.name === filePath
        )?.content ?? ""
      );
    },
    [loadedFiles]
  );

  return {
    saveFile,
    saveFileNow,
    deleteFile,
    createFile,
    createFolder,
    deleteFolder,
    loadedFiles,
    loaded,
    getInitialContent,
  };
}