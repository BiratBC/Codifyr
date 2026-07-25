"use client";

import { useEffect, useState } from "react";

type Repository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
};

export default function RepositoryList() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRepositories() {
      try {
        const response = await fetch(
          "http://localhost:3001/github/repositories",
          {
            credentials: "include",
          }
        );

        const data = await response.json();

        setRepositories(data);
      } catch (error) {
        console.error(
          "Failed to load repositories",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadRepositories();
  }, []);

  if (loading) {
    return <p>Loading repositories...</p>;
  }

  return (
    <div className="space-y-3">
      {repositories.map((repo) => (
        <div
          key={repo.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div>
            <h2 className="font-semibold">
              {repo.name}
            </h2>

            <p className="text-sm text-gray-500">
              {repo.fullName}
            </p>
          </div>

          <button className="rounded bg-blue-600 px-4 py-2 text-white">
            Open
          </button>
        </div>
      ))}
    </div>
  );
}