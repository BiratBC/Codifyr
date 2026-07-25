import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    // Temporary:
    // In production, retrieve this from the authenticated session.
    const accessToken = req.headers.authorization
      ?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        message: "GitHub authentication required",
      });
    }

    const octokit = new Octokit({
      auth: accessToken,
    });

    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 50,
    });

    const repositories = data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
    }));

    res.json(repositories);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch repositories",
    });
  }
});

export default router;