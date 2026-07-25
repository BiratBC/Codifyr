"use client";

export default function GitHubConnect() {
  const connectGitHub = () => {
    window.location.href =
      "http://localhost:3001/auth/github/login";
  };

  return (
    <button
      onClick={connectGitHub}
      className="rounded-lg bg-black px-4 py-2 text-white"
    >
      Connect GitHub
    </button>
  );
}