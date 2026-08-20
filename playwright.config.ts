import { defineConfig } from "@playwright/test";

// E2E: minimal smoke coverage against a real `wrangler dev`, per AGENTS.md
// "Testing conventions". Deliberately light — the frontend pages are actively
// evolving in other in-flight work, so this isn't trying to be a full UI
// regression suite.
//
// wrangler.e2e.toml is a self-contained config (fake D1 id, no live
// Cloudflare account needed) so this can run in any sandbox — see that file's
// header comment.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8787",
  },
  webServer: {
    command:
      "npm run build && npx wrangler d1 migrations apply rummikub-scores-e2e-db --local --config wrangler.e2e.toml && npx wrangler dev --config wrangler.e2e.toml",
    url: "http://localhost:8787/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
