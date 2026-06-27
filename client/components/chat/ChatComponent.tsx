"use client";

import React, {
  useState,
  useRef,
  KeyboardEvent,
  ChangeEvent,
  FormEvent,
  Dispatch,
  SetStateAction,
  RefObject
} from "react";

import { Message } from "@/types/wstypes";
interface CodeProps {
  code: string | undefined;
  users: string[];
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  messages: Message[];
  username: string | undefined;
  status: any;
  wsRef: RefObject<WebSocket | null>;
}
import { formatTime } from "@/utils/helperFunc";

const ChatComponent = ({ code, users, messages, username, status, wsRef, setSidebarOpen}: CodeProps) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

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
  return (
    <>
      {/* Chat column */}
      <div className="flex w-80 flex-shrink-0 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-[#111111] px-5">
          <button
            onClick={() => setSidebarOpen((s: any) => !s)}
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

          {messages.map((msg: any) => {
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
    </>
  );
};

export default ChatComponent;
