"use client";

import { useEffect, useRef, useState } from "react";

export type RunStatus = "idle" | "loading" | "running" | "done" | "error";

interface OutputLine {
  type: "stdout" | "stderr" | "error" | "info";
  text: string;
}

interface CodeRunnerProps {
  code: string;
  language: string;
  onClose: () => void;
}

// Local self-hosted Piston instance — started via Docker
const PISTON_API = "/api/piston/v2/execute";

// Piston language + version map (must match installed package names exactly)
const PISTON_LANGS: Record<string, { language: string; version: string }> = {
  javascript: { language: "node",       version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3"   },
  c:          { language: "c",          version: "10.2.0"  },
  cpp:        { language: "c++",        version: "10.2.0"  },
  java:       { language: "java",       version: "15.0.2"  },
  csharp:     { language: "mono",       version: "6.12.0"  },
  go:         { language: "go",         version: "1.16.2"  },
  rust:       { language: "rust",       version: "1.68.2"  },
  ruby:       { language: "ruby",       version: "3.0.1"   },
  php:        { language: "php",        version: "8.2.3"   },
  kotlin:     { language: "kotlin",     version: "1.8.20"  },
  swift:      { language: "swift",      version: "5.3.3"   },
  shell:      { language: "bash",       version: "5.2.0"   },
  sql:        { language: "sqlite3",    version: "3.36.0"  },
};
export default function CodeRunner({ code, language, onClose }: CodeRunnerProps) {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function addLine(type: OutputLine["type"], text: string) {
    setLines((prev) => [...prev, { type, text }]);
  }

  function clear() {
    setLines([]);
  }

  async function run() {
    clear();
    setStatus("running");

    try {
      if (language === "javascript") {
        try {
          await runViaPiston(code, "javascript");
        } catch {
          await runJS(code);
        }
      } else if (language === "typescript") {
        try {
          await runViaPiston(code, "typescript");
        } catch {
          await runTS(code);
        }
      } else if (language === "python") {
        await runPython(code);
      } else if (language === "html") {
        runHTML(code);
      } else {
        await runViaPiston(code, language);
      }
      setStatus("done");
    } catch (err: any) {
      addLine("error", `Error: ${err?.message ?? String(err)}`);
      setStatus("error");
    }
  }

  // ── JavaScript ──────────────────────────────────────────────────────────────
  async function runJS(src: string) {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Intercept console.log / error / warn
    console.log = (...args) => {
      const text = args.map((a) =>
        typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
      ).join(" ");
      addLine("stdout", text);
    };
    console.error = (...args) => addLine("stderr", args.map(String).join(" "));
    console.warn  = (...args) => addLine("stderr", "⚠ " + args.map(String).join(" "));

    try {
      // Wrap in async IIFE so top-level await works
      const fn = new Function(`return (async () => { ${src} })()`);
      await fn();
    } finally {
      console.log   = originalLog;
      console.error = originalError;
      console.warn  = originalWarn;
    }
  }

  // ── TypeScript ──────────────────────────────────────────────────────────────
  async function runTS(src: string) {
    addLine("info", "Compiling TypeScript…");
    // sucrase strips types without full type-checking — fast and browser-friendly
    const { transform } = await import("sucrase");
    const { code: jsCode } = transform(src, {
      transforms: ["typescript"],
      disableESTransforms: true,
    });
    addLine("info", "Running…");
    await runJS(jsCode);
  }

  // ── Python (Pyodide) ────────────────────────────────────────────────────────
  async function runPython(src: string) {
    if (!pyodideRef.current) {
      addLine("info", "Loading Python runtime (first run may take ~10s)…");
      setStatus("loading");

      // Load Pyodide from CDN
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide"));
        document.head.appendChild(script);
      });

      pyodideRef.current = await (window as any).loadPyodide({
        stdout: (text: string) => addLine("stdout", text),
        stderr: (text: string) => addLine("stderr", text),
      });
      addLine("info", "Python ready.");
      setStatus("running");
    }

    await pyodideRef.current.runPythonAsync(src);
  }

  // ── HTML preview ────────────────────────────────────────────────────────────
  function runHTML(src: string) {
    addLine("info", "Opening HTML preview in new tab…");
    const blob = new Blob([src], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  // ── Piston API (everything else) ────────────────────────────────────────────
  async function runViaPiston(src: string, lang: string) {
    const pistonLang = PISTON_LANGS[lang];
    if (!pistonLang) {
      addLine("error", `Running ${lang} is not supported yet.`);
      return;
    }

    addLine("info", `Running ${lang} via Piston API…`);

    const res = await fetch(PISTON_API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: pistonLang.language,
        version:  pistonLang.version,
        files:    [{ content: src }],
      }),
    });

    if (!res.ok) throw new Error(`Piston API error: ${res.status}`);

    const data = await res.json();
    const run  = data.run;

    if (run.stdout) run.stdout.split("\n").forEach((l: string) => addLine("stdout", l));
    if (run.stderr) run.stderr.split("\n").forEach((l: string) => addLine("stderr", l));
    if (run.code !== 0) addLine("error", `Exited with code ${run.code}`);
  }

  const statusColor = {
    idle:    "text-zinc-500",
    loading: "text-yellow-400",
    running: "text-yellow-400",
    done:    "text-emerald-400",
    error:   "text-red-400",
  }[status];

  const statusLabel = {
    idle:    "ready",
    loading: "loading…",
    running: "running…",
    done:    "done",
    error:   "error",
  }[status];

  return (
    <div className="flex h-56 flex-shrink-0 flex-col border-t border-white/10 bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3">
        <button
          onClick={run}
          disabled={status === "running" || status === "loading"}
          className="flex items-center gap-1.5 rounded bg-emerald-400 px-3 py-1 font-mono text-xs font-bold text-black transition hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ▶ Run
        </button>

        <button
          onClick={clear}
          className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          Clear
        </button>

        <span className={`ml-auto font-mono text-xs ${statusColor}`}>
          {statusLabel}
        </span>

        <button
          onClick={onClose}
          className="ml-2 text-zinc-600 hover:text-zinc-300 transition text-sm"
          title="Close output panel"
        >
          ✕
        </button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs leading-relaxed">
        {lines.length === 0 && (
          <span className="text-zinc-600">
            Press ▶ Run to execute the current file.
          </span>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "stdout" ? "text-zinc-200" :
              line.type === "stderr" ? "text-yellow-400" :
              line.type === "error"  ? "text-red-400" :
              "text-zinc-500 italic"
            }
          >
            {line.text || "\u00A0"}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}