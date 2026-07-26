"use client";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
  FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Head from "next/head";
import type { Message, Status } from "@/types/wstypes";
import { formatTime } from "@/utils/helperFunc";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import FileExplorer, { FileEntry } from "@/components/editor/FileExplorer";
import CodeRunner from "@/components/editor/CodeRunner";
import { langFromFilename } from "@/components/editor/FileExplorer";
import { usePersistedFiles } from "@/hooks/usePersistedFiles";
import ChangeReviewModal, { PendingChange } from "@/components/editor/ChangeReviewModal";
const WS_URL = "ws://localhost:5000";


export default function Room() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.roomId as string | undefined;
  const code = rawCode?.toUpperCase();

  const [status, setStatus] = useState<Status>("connecting");

  const [messages, setMessages] = useState<Message[]>([]);

  const [users, setUsers] = useState<string[]>([]);

  const [input, setInput] = useState("");

  const [copied, setCopied] = useState(false);

  const [username, setUsername] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPin, setClaimPin] = useState("");
  const [claimError, setClaimError] = useState("");

  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [proposalMsg, setProposalMsg] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [showRunner, setShowRunner] = useState(false);
  const [editorCode, setEditorCode] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  const messageIdRef = useRef(0);
  const {
    saveFile,
    saveFileNow,
    deleteFile,
    createFile,
    createFolder,
    deleteFolder,
    loadedFiles,
    loaded,
    getInitialContent,
  } = usePersistedFiles(code ?? "", username);

  const addMessage = useCallback((msg: Message) => {
    messageIdRef.current += 1;

    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: messageIdRef.current.toString(),
      },
    ]);
  }, []);
  const connect = useCallback(
    (roomCode: string, name: string) => {
      if (wsRef.current) {
        // Mark the old socket as an intentional close so its onclose
        // handler below knows not to schedule a reconnect for it.
        (wsRef.current as any)._intentionalClose = true;
        wsRef.current.close();
      }

      const ws = new WebSocket(WS_URL);

      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");

        ws.send(
          JSON.stringify({
            type: "join",
            roomCode,
            username: name,
          }),
        );
      };

      ws.onmessage = (e: MessageEvent) => {
        let data: any;

        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }

        if (data.type === "joined") {
          setUsers(data.users);

          addMessage({
            type: "system",
            content: `You joined room ${data.roomCode}`,
            timestamp: Date.now(),
          });
        } else if (data.type === "system") {
          setUsers(data.users);

          addMessage({
            type: "system",
            content: data.content,
            timestamp: data.timestamp,
          });
        } else if (data.type === "message") {
          addMessage(data);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");

        // Don't auto-reconnect if we closed this socket ourselves
        // (e.g. because connect() was called again, or the component
        // unmounted). Only real, unexpected drops should retry.
        if ((ws as any)._intentionalClose) return;

        reconnectRef.current = setTimeout(() => {
          const storedName = sessionStorage.getItem("chat_username");

          if (storedName && roomCode) {
            connect(roomCode, storedName);
          }
        }, 3000);
      };

      ws.onerror = () => {
        // WebSocket automatically closes after an error — we don't need
        // to call ws.close() here. Calling it manually was bypassing the
        // _intentionalClose guard and causing an infinite reconnect loop.
        setStatus("disconnected");
      };
    },
    [addMessage],
  );

  // Init
  useEffect(() => {
    if (!code || typeof code !== "string") return;

    const storedName = sessionStorage.getItem("chat_username");

    if (!storedName) {
      router.replace("/");
      return;
    }

    setUsername(storedName);

    connect(code, storedName);

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }

      if (wsRef.current) {
        (wsRef.current as any)._intentionalClose = true;
        wsRef.current.close();
      }
    };
  }, [code, connect]); // router intentionally omitted — only used for one-time redirect on mount

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  function sendMessage(e?: FormEvent<HTMLFormElement> | React.MouseEvent) {
    e?.preventDefault();

    const content = input.trim();

    if (!content || status !== "connected") {
      return;
    }

    wsRef.current?.send(
      JSON.stringify({
        type: "message",
        content,
      }),
    );

    setInput("");

    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function copyCode() {
    navigator.clipboard
      .writeText(typeof code === "string" ? code : "")
      .then(() => {
        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2000);
      });
  }

  async function handleClaimOwnerPasscode(e: FormEvent) {
    e.preventDefault();
    if (!claimPin.trim()) return setClaimError("Enter the passcode PIN.");
    setClaimError("");

    try {
      const res = await fetch("/api/rooms/verify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code, passcode: claimPin.trim() }),
      });
      const data = await res.json();

      if (data.isOwner) {
        setIsOwner(true);
        sessionStorage.setItem(`owner_passcode_${code}`, claimPin.trim());
        setShowClaimModal(false);
        setClaimPin("");
      } else {
        setClaimError(data.error || "Incorrect passcode.");
      }
    } catch {
      setClaimError("Server error verifying passcode.");
    }
  }

  const fetchPendingChanges = useCallback(() => {
    if (!code) return;
    fetch(`/api/changes?roomCode=${code}`)
      .then((r) => r.json())
      .then((data) => setPendingChanges(data.changes ?? []))
      .catch(console.error);
  }, [code]);

  useEffect(() => {
    fetchPendingChanges();
    const interval = setInterval(fetchPendingChanges, 4000);
    return () => clearInterval(interval);
  }, [fetchPendingChanges]);

  async function handleSubmitForReview() {
    if (!code || !activeFile || !editorCode) return;
    setProposalMsg("Submitting...");
    try {
      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          filePath: activeFile.path,
          authorName: username,
          proposedContent: editorCode,
          baseContent: getInitialContent(activeFile.path),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProposalMsg("Submitted for Owner Review!");
        setTimeout(() => setProposalMsg(""), 3000);
        fetchPendingChanges();
      } else {
        setProposalMsg(data.error || "Failed to submit proposal");
      }
    } catch {
      setProposalMsg("Server error submitting proposal");
    }
  }

  async function handleAcceptChange(change: PendingChange) {
    try {
      await fetch("/api/changes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeId: change.id,
          action: "accept",
          roomCode: code,
          filePath: change.file_path,
          proposedContent: change.proposed_content,
        }),
      });
      saveFileNow(change.file_path, change.proposed_content);
      fetchPendingChanges();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRejectChange(change: PendingChange) {
    try {
      await fetch("/api/changes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeId: change.id,
          action: "reject",
          roomCode: code,
          filePath: change.file_path,
        }),
      });
      // Synchronously revert file back to initial base_content
      saveFileNow(change.file_path, change.base_content);
      if (activeFile?.path === change.file_path) {
        setEditorCode(change.base_content);
      }
      fetchPendingChanges();
    } catch (err) {
      console.error(err);
    }
  }

  function handleDiscardUnsubmittedEdits() {
    if (!activeFile) return;
    const baseContent = getInitialContent(activeFile.path);
    setEditorCode(baseContent);
    saveFileNow(activeFile.path, baseContent);
    setProposalMsg("Unsubmitted edits discarded");
    setTimeout(() => setProposalMsg(""), 3000);
  }

  const statusColor =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-yellow-400"
        : "bg-red-400";

  return (
    <>
      <Head>
        <title>{typeof code === "string" ? `#${code}` : "Room"} — Chat</title>
      </Head>

      <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-white">
        {/* Sidebar */}
        <aside
          className={`flex flex-col overflow-y-auto border-r border-white/10 bg-[#111111] transition-all duration-300 ${
            sidebarOpen ? "w-60 p-5" : "w-0 overflow-hidden p-0"
          }`}
        >
          {/* Top */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              ← back
            </button>

            <span className="font-mono text-sm font-bold text-emerald-400">
              ▣ rooms
            </span>
          </div>

          {/* Room code */}
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Room code
            </span>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl font-bold tracking-[0.2em] text-emerald-400">
                {code}
              </span>

              <button
                onClick={copyCode}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700"
              >
                {copied ? <span className="text-xs">✓</span> : <CopyIcon />}
              </button>
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              Share this code to invite others
            </p>
          </div>

          {/* Status */}
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
              <span className="font-mono text-xs text-zinc-400">{status}</span>
            </div>

            {!isOwner && (
              <button
                onClick={() => setShowClaimModal(true)}
                className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition"
                title="Claim Room Ownership using secret PIN"
              >
                👑 Claim Owner
              </button>
            )}
          </div>

          {/* Users */}
          <div className="mt-6 flex-1">
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Online — {users.length}
            </span>

            <ul className="flex flex-col gap-1">
              {users.map((u) => (
                <li
                  key={u}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-xs font-bold text-zinc-300">
                    {u[0].toUpperCase()}
                  </span>

                  <span
                    className={`flex items-center gap-2 text-sm ${
                      u === username ? "text-emerald-400" : "text-white"
                    }`}
                  >
                    {u}

                    {u === username && isOwner && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        👑 Owner
                      </span>
                    )}

                    {u === username && !isOwner && (
                      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        ✏️ Editor
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1">
          {/* File explorer */}
          {code && (
            <FileExplorer
              roomCode={code}
              activeFile={activeFile?.path ?? null}
              persistedFiles={loadedFiles}
              onFileSelect={setActiveFile}
              onFileCreate={(p) => createFile(p)}
              onFileDelete={(p) => deleteFile(p)}
              onFolderCreate={(p) => createFolder(p)}
              onFolderDelete={(p) => deleteFolder(p)}
              onFilesChange={(allEntries) => {
                // Auto-select first actual code file (skip folders)
                const codeFiles = allEntries.filter((e) => !e.isFolder);
                if (!activeFile && codeFiles.length > 0) {
                  setActiveFile(codeFiles[0]);
                } else if (activeFile && activeFile.isFolder && codeFiles.length > 0) {
                  setActiveFile(codeFiles[0]);
                }
              }}
            />
          )}

          {/* Code editor */}
          <div className="min-w-0 flex-1 border-r border-white/10 flex flex-col">
            {/* Active file tab + review + run button */}
            {activeFile && (
              <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-[#111111] px-4">
                <span className="font-mono text-xs text-zinc-300 flex-1 truncate" title={activeFile.path}>
                  {activeFile.path}
                </span>

                {proposalMsg && (
                  <span className="font-mono text-xs text-emerald-400 font-semibold animate-pulse">
                    {proposalMsg}
                  </span>
                )}

                {isOwner && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-xs font-bold transition border ${
                      pendingChanges.length > 0
                        ? "bg-amber-400/20 border-amber-400/40 text-amber-300 animate-pulse"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    👑 Pending Reviews ({pendingChanges.length})
                  </button>
                )}

                {!isOwner && (
                  <button
                    onClick={handleSubmitForReview}
                    className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition"
                  >
                    📤 Submit for Review
                  </button>
                )}

                <button
                  onClick={() => setShowRunner((s) => !s)}
                  className="flex items-center gap-1 rounded bg-emerald-400 px-2.5 py-1 font-mono text-xs font-bold text-black hover:bg-emerald-300 transition"
                >
                  ▶ Run
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {code && username && activeFile && loaded ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CollaborativeEditor
                    key={activeFile.path}
                    roomCode={code}
                    username={username}
                    filePath={activeFile.path}
                    filename={activeFile.name}
                    initialContent={getInitialContent(activeFile.path)}
                    isOwner={isOwner}
                    onCodeChange={(newCode) => {
                      setEditorCode(newCode);
                      if (isOwner) {
                        saveFile(activeFile!.path, newCode);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
                  {!loaded ? "Loading files…" : activeFile ? "Loading…" : "Create or select a file →"}
                </div>
              )}
              {showRunner && activeFile && (
                <div className="h-56 flex-shrink-0">
                  <CodeRunner
                    code={editorCode}
                    language={langFromFilename(activeFile.name)}
                    onClose={() => setShowRunner(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Chat column */}
          <div className="flex w-80 flex-shrink-0 flex-col">
          {/* Header */}
          <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-[#111111] px-5">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="rounded p-1 text-lg text-zinc-400 transition hover:text-white"
            >
              ☰
            </button>

            <span className="flex-1 font-mono text-sm font-bold">#{code}</span>

            <span className="text-xs text-zinc-400">{users.length} online</span>
          </header>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-5">
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-16 text-zinc-500">
                <span className="text-4xl">▣</span>

                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.type === "system") {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center justify-center gap-2 py-2"
                  >
                    <span className="text-xs italic text-zinc-500">
                      {msg.content}
                    </span>

                    <span className="text-[10px] text-zinc-600">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                );
              }

              const isMe = msg.username === username;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 py-1 ${
                    isMe ? "flex-row-reverse" : ""
                  }`}
                >
                  {!isMe && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-xs font-bold text-zinc-300">
                      {msg.username[0].toUpperCase()}
                    </span>
                  )}

                  <div
                    className={`max-w-[68%] rounded-2xl border px-4 py-3 ${
                      isMe
                        ? "rounded-br-md border-emerald-400/20 bg-emerald-400/10"
                        : "rounded-bl-md border-white/10 bg-zinc-900"
                    }`}
                  >
                    {!isMe && (
                      <span className="mb-1 block font-mono text-[11px] font-semibold text-emerald-400">
                        {msg.username}
                      </span>
                    )}

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                      {msg.content}
                    </p>

                    <span className="mt-1 block text-right text-[10px] text-zinc-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-3 border-t border-white/10 bg-[#111111] p-4">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                status === "connected" ? `Message #${code}…` : `${status}…`
              }
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={status !== "connected"}
              maxLength={1000}
              className={`flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 ${
                status !== "connected" ? "cursor-not-allowed opacity-50" : ""
              }`}
            />

            <button
              onClick={sendMessage}
              disabled={!input.trim() || status !== "connected"}
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold transition ${
                !input.trim() || status !== "connected"
                  ? "cursor-not-allowed bg-emerald-400/30 text-black/50"
                  : "bg-emerald-400 text-black hover:bg-emerald-300"
              }`}
            >
              ↑
            </button>
          </div>
          </div>
        </main>
        {/* Claim Ownership Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  👑 Claim Room Ownership
                </span>
                <button
                  onClick={() => {
                    setShowClaimModal(false);
                    setClaimError("");
                  }}
                  className="text-xs text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Enter the secret Owner PIN / Passcode set when this room was created to reclaim 👑 Owner status.
              </p>

              <form onSubmit={handleClaimOwnerPasscode} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Enter Secret Owner PIN"
                  value={claimPin}
                  onChange={(e) => {
                    setClaimPin(e.target.value);
                    setClaimError("");
                  }}
                  autoFocus
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 font-mono"
                />

                {claimError && (
                  <p className="text-xs text-red-400">⚠ {claimError}</p>
                )}

                <div className="flex gap-2 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClaimModal(false);
                      setClaimError("");
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-300"
                  >
                    Verify & Claim →
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Review Modal for Owner */}
        {showReviewModal && (
          <ChangeReviewModal
            roomCode={code ?? ""}
            changes={pendingChanges}
            onClose={() => setShowReviewModal(false)}
            onAccept={(change) => {
              handleAcceptChange(change);
            }}
            onReject={(change) => {
              handleRejectChange(change);
            }}
          />
        )}
      </div>
    </>
  );
}
export function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}