import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID! || "Ov23liHS2xY3MRwXYXmV";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET! || "e3695b67319ae271d1d878f711222b73ee25acbf";
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL! || "http://localhost:3001/auth/github/callback";

// Step 1: Redirect user to GitHub
router.get("/login", (req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "repo read:user user:email",
  });

  res.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
});

// Step 2: GitHub redirects back with code
router.get("/callback", async (req: Request, res: Response) => {
  try {
    console.log(GITHUB_CLIENT_SECRET);
    
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).send("Authorization code missing");
    }

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = response.data.access_token;

    // TODO:
    // Store token securely in a session/database.
    // Do NOT expose it directly to the frontend.

    res.redirect(
      `${"http://localhost:3000"}/github/connect?success=true`
    );

  } catch (error) {
    console.error("GitHub OAuth error:", error);

    res.status(500).send("GitHub authentication failed");
  }
});

export default router;