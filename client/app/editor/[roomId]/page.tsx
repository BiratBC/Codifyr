"use client";
import { useEffect, useRef, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Head from "next/head";
import type { Message, Status } from "@/types/wstypes";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import FileExplorer, { FileEntry } from "@/components/editor/FileExplorer";
import CodeRunner from "@/components/editor/CodeRunner";
import { langFromFilename } from "@/components/editor/FileExplorer";
import { useChatSocket } from "@/hooks/useChatSocket";
import { usePersistedFiles } from "@/hooks/usePersistedFiles";
import ChangeReviewModal, { PendingChange } from "@/components/editor/ChangeReviewModal";
const WS_URL = "ws://localhost:5000";

// Import components
import ChatComponent from "@/components/chat/ChatComponent";
import CopyIcon from "@/components/icons/CopyIcon";

import SideBar from "@/components/editor/SideBar";

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.roomId as string | undefined;
  const code = rawCode?.toUpperCase();

  const [status, setStatus] = useState<Status>("connecting");

  const [messages, setMessages] = useState<Message[]>([]);

  const [users, setUsers] = useState<string[]>([]);


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
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  const { connect, disconnect, wsRef} = useChatSocket({
    setStatus,
    setUsers,
    addMessage,
  });


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
        <SideBar
          sidebarOpen={sidebarOpen}
          code={code}
          users={users}
          username={username}
          status={status}
          isOwner={isOwner}
          showClaimModal={showClaimModal}
          setShowClaimModal={setShowClaimModal}
        />
        

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

          <ChatComponent
            code={code}
            users={users}
            setSidebarOpen={setSidebarOpen}
            messages={messages}
            username={username}
            status={status}
            wsRef={wsRef}
          />
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
