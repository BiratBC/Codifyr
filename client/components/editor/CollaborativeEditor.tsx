"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { MonacoBinding as MonacoBindingType } from "y-monaco";
import type * as Monaco from "monaco-editor";

// monaco-editor touches `window` as soon as its module is evaluated, which
// crashes Next.js's server-side render pass for this client component (no
// `window` exists there). So instead of a static top-level import, we load
// it dynamically — this only ever runs in the browser, after mount — and
// point @monaco-editor/react's loader at that instance so it matches the
// one y-monaco's MonacoBinding will bind against.
//
// We also wire up MonacoEnvironment.getWorker here. Without it, Monaco
// can't find its web workers (the bundler/Turbopack doesn't know to
// emit them automatically) and silently falls back to running tokenizing,
// language features, etc. on the main thread — which works, but can
// cause noticeable typing lag/jank in larger files.
let monacoLoadPromise: Promise<typeof Monaco> | null = null;
function loadMonaco() {
  if (!monacoLoadPromise) {
    monacoLoadPromise = import("monaco-editor").then((mod) => {
      (self as any).MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
          switch (label) {
            case "json":
              return new Worker(
                new URL(
                  "monaco-editor/esm/vs/language/json/json.worker?worker",
                  import.meta.url
                )
              );
            case "css":
            case "scss":
            case "less":
              return new Worker(
                new URL(
                  "monaco-editor/esm/vs/language/css/css.worker?worker",
                  import.meta.url
                )
              );
            case "html":
            case "handlebars":
            case "razor":
              return new Worker(
                new URL(
                  "monaco-editor/esm/vs/language/html/html.worker?worker",
                  import.meta.url
                )
              );
            case "typescript":
            case "javascript":
              return new Worker(
                new URL(
                  "monaco-editor/esm/vs/language/typescript/ts.worker?worker",
                  import.meta.url
                )
              );
            default:
              return new Worker(
                new URL(
                  "monaco-editor/esm/vs/editor/editor.worker?worker",
                  import.meta.url
                )
              );
          }
        },
      };

      loader.config({ monaco: mod });
      return mod;
    });
  }
  return monacoLoadPromise;
}

// y-monaco itself also touches browser-only APIs at module-evaluation
// time (same SSR problem as monaco-editor above), so it needs the same
// dynamic-import treatment rather than a static top-level import.
let yMonacoLoadPromise: Promise<typeof import("y-monaco")> | null = null;
function loadYMonaco() {
  if (!yMonacoLoadPromise) {
    yMonacoLoadPromise = import("y-monaco");
  }
  return yMonacoLoadPromise;
}

import { langFromFilename } from "./FileExplorer";

const YJS_WS_URL = "ws://localhost:6000";

type SyncStatus = "connecting" | "connected" | "disconnected";

interface CollaborativeEditorProps {
  roomCode: string;
  username: string;
  filename: string;
  onCodeChange?: (code: string) => void;
}

// A handful of distinct colors so each user's cursor/selection is
// visually identifiable. Picked deterministically from the username
// so the same person gets the same color across reconnects.
const CURSOR_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export default function CollaborativeEditor({
  roomCode,
  username,
  filename,
  onCodeChange,
}: CollaborativeEditorProps) {
  const language = langFromFilename(filename);
  // Each file gets its own Yjs doc, keyed by roomCode:filename
  const docName = `${roomCode}:${filename}`;
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [onlineCount, setOnlineCount] = useState(1);

  const [monacoReady, setMonacoReady] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBindingType | null>(null);
  const MonacoBindingClassRef = useRef<typeof MonacoBindingType | null>(null);

  // Kick off the dynamic monaco-editor + y-monaco imports once, browser only.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMonaco(), loadYMonaco()]).then(([, yMonacoMod]) => {
      if (cancelled) return;
      MonacoBindingClassRef.current = yMonacoMod.MonacoBinding;
      setMonacoReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep references alive across the component's lifetime; clean up
  // the Yjs doc + provider + binding when the room/editor unmounts.
  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const provider = new WebsocketProvider(YJS_WS_URL, docName, doc);
    providerRef.current = provider;

    provider.awareness.setLocalStateField("user", {
      name: username,
      color: colorForName(username),
    });

    provider.on("status", ({ status: s }: { status: string }) => {
      setStatus(s === "connected" ? "connected" : "connecting");
    });

    const updatePresence = () => {
      setOnlineCount(provider.awareness.getStates().size);
    };
    provider.awareness.on("change", updatePresence);
    updatePresence();

    return () => {
      provider.awareness.off("change", updatePresence);
      // Destroy binding first — it holds a reference to yText which
      // lives inside doc. If we destroy doc first, binding.destroy()
      // tries to unobserve an already-gone yText and yjs warns.
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      provider.destroy();
      doc.destroy();
    };
  }, [docName, username]);

  const handleMount: OnMount = (editor) => {
    const doc = docRef.current;
    const provider = providerRef.current;
    const MonacoBindingClass = MonacoBindingClassRef.current;
    if (!doc || !provider || !MonacoBindingClass) return;

    const yText = doc.getText("monaco");

    bindingRef.current = new MonacoBindingClass(
      yText,
      editor.getModel() as Monaco.editor.ITextModel,
      new Set([editor]),
      provider.awareness
    );

    // Emit current code whenever it changes (for the code runner)
    editor.onDidChangeModelContent(() => {
      onCodeChange?.(editor.getValue());
    });
    // Emit initial value too
    onCodeChange?.(editor.getValue());
  };

  const statusColor =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
      ? "bg-yellow-400"
      : "bg-red-400";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b border-white/10 bg-[#111111] px-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="font-mono text-xs text-zinc-400">
            {status === "connected" ? "synced" : status}
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-500">
          {onlineCount} editing
        </span>
      </div>

      <div className="flex-1">
        {monacoReady ? (
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Loading editor…
          </div>
        )}
      </div>
    </div>
  );
}