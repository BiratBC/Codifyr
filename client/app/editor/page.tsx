"use client"
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";

// Generates a random 6-char uppercase room code
function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Lobby() {
  const router = useRouter();

  const [tab, setTab] = useState("create");
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");

  useEffect(() => {
  setCreatedCode(randomCode());
}, []);

  function handleUsernameChange(e : any) {
    setUsername(e.target.value);
    setError("");
  }

  function handleJoinCodeChange(e : any) {
    setJoinCode(
      e.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
    );
    setError("");
  }

  async function handleSubmit(e : any) {
    e.preventDefault();

    const name = username.trim();

    if (!name) return setError("Please enter a username.");
    if (name.length < 2)
      return setError("Username must be at least 2 characters.");
    if (name.length > 20)
      return setError("Username must be under 20 characters.");

    if (tab === "join") {
      if (joinCode.length !== 6) {
        return setError("Room code must be exactly 6 characters.");
      }

      setLoading(true);

      try {
        const res = await fetch(
          `http://localhost:5000/editor/${joinCode}`
        );

        const data = await res.json();

        if (!data.exists) {
          setLoading(false);
          return setError("Room not found. Double-check the code.");
        }
      } catch {
        setLoading(false);
        return setError("Cannot reach the server. Is it running?");
      }
    }

    const code = tab === "create" ? createdCode : joinCode;

    sessionStorage.setItem("chat_username", name);

    router.push(`/editor/${code}`);
  }

  return (
    <>
      <Head>
        <title>Rooms — Chat</title>
      </Head>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] px-6">
        {/* Grid background */}
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

        {/* Card */}
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-9 shadow-[0_0_60px_rgba(90,255,163,0.04),0_24px_48px_rgba(0,0,0,0.45)]">
          {/* Logo */}
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-2xl text-emerald-400">▣</span>

            <span className="font-mono text-2xl font-bold tracking-tight text-white">
              rooms
            </span>
          </div>

          <p className="mb-7 text-sm text-zinc-400">
            Real-time chat with shareable room codes.
          </p>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl bg-black/40 p-1">
            {["create", "join"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError("");
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  tab === t
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t === "create"
                  ? "＋ Create room"
                  : "↗ Join room"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2"
          >
            {/* Username */}
            <label className="mt-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Your name
            </label>

            <input
              type="text"
              placeholder="e.g. alex"
              value={username}
              onChange={handleUsernameChange}
              autoFocus
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[15px] text-white outline-none transition focus:border-emerald-400"
            />

            {/* Create room preview */}
            {tab === "create" && (
              <div className="mt-1 flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="text-xs font-medium text-zinc-400">
                  Room code
                </span>

                <span className="flex-1 font-mono text-xl tracking-[0.25em] text-emerald-400">
                  {createdCode}
                </span>

                <button
                  type="button"
                  title="Generate new code"
                  onClick={() => {
                    setCreatedCode(randomCode());
                    setError("");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-zinc-800 text-sm text-zinc-300 transition hover:bg-zinc-700"
                >
                  ↻
                </button>
              </div>
            )}

            {/* Join room */}
            {tab === "join" && (
              <>
                <label className="mt-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Room code
                </label>

                <input
                  type="text"
                  placeholder="XXXXXX"
                  value={joinCode}
                  onChange={handleJoinCodeChange}
                  maxLength={6}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-lg tracking-[0.25em] text-white outline-none transition focus:border-emerald-400"
                />
              </>
            )}

            {/* Error */}
            {error && (
              <p className="mt-1 text-sm text-red-400">
                ⚠ {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                loading
                  ? "cursor-not-allowed bg-emerald-400/60 text-black"
                  : "bg-emerald-400 text-black hover:scale-[1.01] hover:bg-emerald-300"
              }`}
            >
              {loading
                ? "Connecting…"
                : tab === "create"
                ? "Create & enter room →"
                : "Join room →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}