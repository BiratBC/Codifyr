"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Head from "next/head";
import type { Message, Status } from "@/types/wstypes";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import FileExplorer, { FileEntry } from "@/components/editor/FileExplorer";
import CodeRunner from "@/components/editor/CodeRunner";
import { langFromFilename } from "@/components/editor/FileExplorer";
import { useChatSocket } from "@/hooks/useChatSocket";

// Import components
import ChatComponent from "@/components/chat/ChatComponent";

import SideBar from "@/components/editor/SideBar";

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const code = params?.roomId as string | undefined;

  const [status, setStatus] = useState<Status>("connecting");

  const [messages, setMessages] = useState<Message[]>([]);

  const [users, setUsers] = useState<string[]>([]);


  const [username, setUsername] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [showRunner, setShowRunner] = useState(false);
  const [editorCode, setEditorCode] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  const messageIdRef = useRef(0);

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
        />

        {/* Main */}
        <main className="flex min-w-0 flex-1">
          {/* File explorer */}
          {code && (
            <FileExplorer
              roomCode={code}
              activeFile={activeFile?.name ?? null}
              onFileSelect={setActiveFile}
              onFilesChange={(files) => {
                // Auto-select first file if none selected yet
                if (!activeFile && files.length > 0) setActiveFile(files[0]);
              }}
            />
          )}

          {/* Code editor */}
          <div className="min-w-0 flex-1 border-r border-white/10 flex flex-col">
            {/* Active file tab + run button */}
            {activeFile && (
              <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-[#111111] px-4">
                <span className="font-mono text-xs text-zinc-300 flex-1">
                  {activeFile.name}
                </span>
                <button
                  onClick={() => setShowRunner((s) => !s)}
                  className="flex items-center gap-1 rounded bg-emerald-400 px-2.5 py-1 font-mono text-xs font-bold text-black hover:bg-emerald-300 transition"
                >
                  ▶ Run
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {code && username && activeFile ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CollaborativeEditor
                    roomCode={code}
                    username={username}
                    filename={activeFile.name}
                    onCodeChange={setEditorCode}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
                  {activeFile ? "Loading…" : "Create or select a file →"}
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
      </div>
    </>
  );
}
