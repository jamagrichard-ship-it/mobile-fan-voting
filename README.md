# Mobile Fan Voting — connector replacement

Replace `server.js` and `package.json` in the GitHub repository with these files.

This uses `ttl-live` instead of `tiktok-live-connector` / EulerStream signer.

**Important:** `ttl-live` is an unofficial community library and may fail if TikTok changes its public LIVE protocol. Test with a low-stakes LIVE before relying on voting.

## Upload on GitHub from mobile
1. In the repo, replace `server.js` with the supplied `server.js`.
2. Replace `package.json` with the supplied `package.json`.
3. Commit directly to `main`.
4. Wait for Render to redeploy.
5. If deploy fails, do not try sending gifts; screenshot the Render build log and share it.

This preserves the existing API routes and frontend expected by the current dashboard.
