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
const WS_URL = "ws://localhost:5000";


export default function Room() {
  const router = useRouter();
  const params = useParams();
  const code = params?.roomId as string | undefined;

  const [status, setStatus] = useState<Status>("connecting");

  const [messages, setMessages] = useState<Message[]>([]);

  const [users, setUsers] = useState<string[]>([]);

  const [input, setInput] = useState("");

  const [copied, setCopied] = useState(false);

  const [username, setUsername] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

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
  const connect = useCallback(
    (roomCode: string, name: string) => {
      if (wsRef.current) {
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

        reconnectRef.current = setTimeout(() => {
          const storedName = sessionStorage.getItem("chat_username");

          if (storedName && roomCode) {
            connect(roomCode, storedName);
          }
        }, 3000);
      };

      ws.onerror = () => ws.close();
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

      wsRef.current?.close();
    };
  }, [code, connect, router]);

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
          <div className="mt-5 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />

            <span className="font-mono text-xs text-zinc-400">{status}</span>
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

                    {u === username && (
                      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        you
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
          {/* Code editor */}
          <div className="min-w-0 flex-1 border-r border-white/10">
            {code && username ? (
              <CollaborativeEditor roomCode={code} username={username} />
            ) : null}
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