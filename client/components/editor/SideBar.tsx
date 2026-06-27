"use client";

import React, { useState, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import CopyIcon from "@/components/icons/CopyIcon";
interface SideBarProps {
  sidebarOpen: boolean;
  code: string | undefined;
  users: string[];
  username: string;
  status: any
}

const SideBar = ({ sidebarOpen, code, users, username, status}: SideBarProps) => {
  const router = useRouter();
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

  const [copied, setCopied] = useState(false);
  return (
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
  );
};

export default SideBar;
