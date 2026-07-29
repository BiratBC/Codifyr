"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// A small fake "live" snippet that types itself out with a couple of
// differently-colored cursors, to evoke multiple people editing the
// same file together — the actual core feature of the product.
const SNIPPET_LINES = [
  { text: "function mergeChanges(docA, docB) {", indent: 0 },
  { text: "const merged = CRDT.sync(docA, docB);", indent: 1 },
  { text: "return merged;", indent: 1 },
  { text: "}", indent: 0 },
];

function useTypewriter(lines: { text: string; indent: number }[], speed = 28) {
  const [shown, setShown] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= lines.length) return;

    const current = lines[lineIndex];

    if (charIndex <= current.text.length) {
      const t = setTimeout(() => {
        setShown((prev) => {
          const next = [...prev];
          next[lineIndex] = current.text.slice(0, charIndex);
          return next;
        });
        setCharIndex((c) => c + 1);
      }, speed);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLineIndex((l) => l + 1);
        setCharIndex(0);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [lineIndex, charIndex, lines, speed]);

  return { shown, lineIndex, done: lineIndex >= lines.length };
}

export default function Home() {
  const { shown, lineIndex, done } = useTypewriter(SNIPPET_LINES);

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0a0a0a] px-6 text-white">
      {/* Grid background, matches the lobby */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex w-full max-w-5xl items-center justify-between py-8">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl text-emerald-400"><img src="/icon.png" alt="" height={24} width={24}/></span>
          <span className="font-mono text-xl font-bold tracking-tight">
            codifyr
          </span>
        </div>

        <Link
          href="/editor"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          Open editor →
        </Link>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 py-16 text-center">
        <div className="flex flex-col items-center gap-5">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-mono text-xs text-emerald-300">
            real-time · multiplayer · code
          </span>

          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Write code together,{" "}
            <span className="text-emerald-400">in the same room.</span>
          </h1>

          <p className="max-w-md text-base leading-relaxed text-zinc-400">
            Codifyr is a live, shared code editor. Open a room, share the
            code, and watch everyone&apos;s changes land instantly — no
            merge conflicts, no waiting your turn.
          </p>
        </div>

        {/* Signature element: a live-typing code snippet with two cursors */}
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left shadow-[0_0_60px_rgba(90,255,163,0.04),0_24px_48px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 font-mono text-xs text-zinc-500">
              merge.ts
            </span>
          </div>

          <div className="px-5 py-5 font-mono text-[13px] leading-relaxed">
            {SNIPPET_LINES.map((line, i) => {
              const text = shown[i] ?? "";
              const isActive = i === lineIndex && !done;
              return (
                <div key={i} style={{ paddingLeft: line.indent * 16 }}>
                  <span className="text-zinc-300">{text}</span>
                  {isActive && (
                    <span className="ml-0.5 inline-block h-[14px] w-[2px] -translate-y-[1px] animate-pulse bg-emerald-400 align-middle" />
                  )}
                </div>
              );
            })}
            {done && (
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>alex and sam are editing this file</span>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/editor"
          className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-emerald-300"
        >
          Create or join a room →
        </Link>
      </main>

      <footer className="relative z-10 pb-8 font-mono text-xs text-zinc-600">
        no signup needed — just a room code
      </footer>
    </div>
  );
}

//netstat -ano | findstr :5000
//taskkill /PID 12345 /F