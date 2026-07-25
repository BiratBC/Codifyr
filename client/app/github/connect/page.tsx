import GitHubConnect from "@/components/github/GitHubConnect";

export default function GitHubPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold">
          Connect GitHub
        </h1>

        <p className="mb-6">
          Connect your GitHub account to access your repositories.
        </p>

        <GitHubConnect />
      </div>
    </main>
  );
}