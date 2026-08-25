import { After, AfterAll, Before, BeforeAll } from "@cucumber/cucumber";
import { chromium, type Browser } from "@playwright/test";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import type { E2EWorld } from "./world";

const PORT = 8791;
const CONFIG = "wrangler.cucumber-e2e.toml";
export const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcess | undefined;
let browser: Browser | undefined;

// Same "own wrangler dev, own database" reasoning as the integration layer's hooks.ts, plus a
// real Chromium instance for Playwright to drive — this is the only layer of the three that
// exercises the actual built frontend in a real browser.
BeforeAll({ timeout: 120_000 }, async () => {
  execSync("npm run build", { stdio: "inherit" });
  execSync(`npx wrangler d1 migrations apply rummikub-scores-cucumber-e2e-db --local --config ${CONFIG}`, {
    stdio: "inherit",
  });
  server = spawn("npx", ["wrangler", "dev", "--config", CONFIG, "--port", String(PORT)], { stdio: "inherit" });
  await waitForHealth(`${BASE_URL}/api/health`);
  browser = await chromium.launch();
});

AfterAll(async () => {
  await browser?.close();
  server?.kill();
});

Before(async function (this: E2EWorld) {
  if (!browser) throw new Error("browser not launched — BeforeAll hook didn't run?");
  this.browser = browser;
  // The organizer is authenticated for the whole scenario, same dev-bypass mechanism the other
  // layers use (wrangler.cucumber-e2e.toml's DEV_AUTH_BYPASS_ENABLED) — see AGENTS.md "Testing
  // conventions". An "anonymous visitor" step creates its own separate, header-less context.
  this.context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "X-Dev-User-Email": "cucumber-e2e@example.com" },
  });
  this.page = await this.context.newPage();
});

After(async function (this: E2EWorld) {
  await this.anonymousContext?.close();
  await this.context.close();
});

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`wrangler dev on ${url} never became healthy`);
}
