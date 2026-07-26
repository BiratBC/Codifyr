"use client";

import { useState } from "react";

export interface PendingChange {
  id: string;
  room_id: string;
  file_path: string;
  author_name: string;
  proposed_content: string;
  base_content: string;
  status: string;
  created_at: string;
}

interface ChangeReviewModalProps {
  roomCode: string;
  changes: PendingChange[];
  onClose: () => void;
  onAccept: (change: PendingChange) => void;
  onReject: (change: PendingChange) => void;
}

export interface DiffLine {
  type: "add" | "remove" | "same";
  text: string;
  baseLineNum?: number;
  proposedLineNum?: number;
}

function computeDiff(baseStr: string = "", proposedStr: string = ""): DiffLine[] {
  const a = baseStr ? baseStr.split("\n") : [];
  const b = proposedStr ? proposedStr.split("\n") : [];

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const raw: { type: "add" | "remove" | "same"; text: string }[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: "same", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "add", text: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      raw.unshift({ type: "remove", text: a[i - 1] });
      i--;
    }
  }

  let baseNum = 1;
  let proposedNum = 1;

  return raw.map((line) => {
    if (line.type === "same") {
      return { ...line, baseLineNum: baseNum++, proposedLineNum: proposedNum++ };
    } else if (line.type === "remove") {
      return { ...line, baseLineNum: baseNum++ };
    } else {
      return { ...line, proposedLineNum: proposedNum++ };
    }
  });
}

export default function ChangeReviewModal({
  changes,
  onClose,
  onAccept,
  onReject,
}: ChangeReviewModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const activeChange = changes[selectedIndex] ?? null;

  if (changes.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-6 text-center shadow-2xl">
          <p className="font-mono text-sm text-zinc-400 mb-4">
            No pending change requests for review.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const diffLines = activeChange
    ? computeDiff(activeChange.base_content, activeChange.proposed_content)
    : [];

  const addedCount = diffLines.filter((l) => l.type === "add").length;
  const removedCount = diffLines.filter((l) => l.type === "remove").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        {/* Sidebar proposals roster */}
        <div className="w-64 border-r border-white/10 bg-[#0d0d0d] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              👑 Proposals ({changes.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {changes.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setSelectedIndex(i)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedIndex === i
                    ? "border-emerald-400/40 bg-emerald-400/10 text-white shadow-lg"
                    : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="font-mono text-xs font-bold truncate text-emerald-300">
                  {c.file_path}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between">
                  <span>By {c.author_name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diff preview panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0a0a0a]">
          {/* Top Bar */}
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-6 bg-[#111111]">
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="font-bold text-white text-sm">{activeChange?.file_path}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">By</span>
              <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">
                {activeChange?.author_name}
              </span>

              {/* Stats badges */}
              <div className="flex items-center gap-1.5 ml-2 font-mono text-[11px]">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
                  +{addedCount}
                </span>
                <span className="rounded bg-rose-500/20 px-2 py-0.5 font-bold text-rose-400 border border-rose-500/30">
                  -{removedCount}
                </span>
              </div>
            </div>

            {/* Actions & View Toggle */}
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center rounded-lg bg-black/40 p-1 border border-white/10">
                <button
                  onClick={() => setViewMode("unified")}
                  className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition ${
                    viewMode === "unified"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Unified
                </button>
                <button
                  onClick={() => setViewMode("split")}
                  className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition ${
                    viewMode === "split"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Split
                </button>
              </div>

              <button
                onClick={() => activeChange && onReject(activeChange)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 font-mono text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
              >
                ✕ Reject Proposal
              </button>
              <button
                onClick={() => activeChange && onAccept(activeChange)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-4 py-1.5 font-mono text-xs font-bold text-black hover:bg-emerald-300 transition shadow-lg shadow-emerald-400/10"
              >
                ✓ Accept & Merge
              </button>
              <button
                onClick={onClose}
                className="ml-2 text-zinc-500 hover:text-white text-base"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Diff Viewer Body */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed select-text">
            {viewMode === "unified" ? (
              /* Unified View */
              <div className="rounded-xl border border-white/10 bg-[#111111] overflow-hidden shadow-inner font-mono text-xs">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center transition-colors ${
                      line.type === "add"
                        ? "bg-emerald-950/40 border-l-4 border-emerald-400 text-emerald-200"
                        : line.type === "remove"
                        ? "bg-rose-950/40 border-l-4 border-rose-500 text-rose-300 line-through opacity-85"
                        : "border-l-4 border-transparent text-zinc-300 hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Line numbers gutter */}
                    <div className="w-12 text-right pr-2 py-1 text-zinc-600 border-r border-white/5 select-none font-mono text-[11px]">
                      {line.baseLineNum ?? ""}
                    </div>
                    <div className="w-12 text-right pr-2 py-1 text-zinc-600 border-r border-white/5 select-none font-mono text-[11px]">
                      {line.proposedLineNum ?? ""}
                    </div>
                    {/* Sign */}
                    <div className="w-6 text-center py-1 font-bold select-none">
                      {line.type === "add" ? (
                        <span className="text-emerald-400">+</span>
                      ) : line.type === "remove" ? (
                        <span className="text-rose-400">-</span>
                      ) : (
                        " "
                      )}
                    </div>
                    {/* Code Content */}
                    <div className="flex-1 py-1 pr-3 whitespace-pre-wrap break-all">
                      {line.text || "\u00A0"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Split View */
              <div className="grid grid-cols-2 gap-3 h-full">
                {/* Left: Original Code */}
                <div className="rounded-xl border border-white/10 bg-[#111111] p-3 overflow-y-auto">
                  <div className="text-[11px] font-bold text-zinc-400 mb-2 uppercase tracking-wider border-b border-white/10 pb-1.5">
                    Original Code (Base)
                  </div>
                  {activeChange?.base_content.split("\n").map((text, idx) => (
                    <div key={idx} className="flex text-zinc-400 py-0.5">
                      <span className="w-8 text-zinc-600 select-none text-right pr-2">{idx + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{text || "\u00A0"}</span>
                    </div>
                  ))}
                </div>

                {/* Right: Proposed Code */}
                <div className="rounded-xl border border-emerald-500/20 bg-[#111111] p-3 overflow-y-auto">
                  <div className="text-[11px] font-bold text-emerald-400 mb-2 uppercase tracking-wider border-b border-white/10 pb-1.5">
                    Proposed Code (Member)
                  </div>
                  {activeChange?.proposed_content.split("\n").map((text, idx) => (
                    <div key={idx} className="flex text-emerald-300 py-0.5 bg-emerald-500/5 px-1 rounded">
                      <span className="w-8 text-zinc-600 select-none text-right pr-2">{idx + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{text || "\u00A0"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
