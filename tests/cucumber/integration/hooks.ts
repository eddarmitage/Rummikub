import { AfterAll, BeforeAll } from "@cucumber/cucumber";
import { execSync, spawn, type ChildProcess } from "node:child_process";

const PORT = 8790;
const CONFIG = "wrangler.cucumber-integration.toml";
export const BASE_URL = `http://localhost:${PORT}/api`;

let server: ChildProcess | undefined;

// cucumber-js isn't a Vitest plugin, so this layer can't reuse vitest-pool-workers' in-process
// workerd like tests/integration/ does — it drives a real, standalone `wrangler dev` over HTTP
// instead, started once for the whole profile run (see wrangler.cucumber-integration.toml's
// header comment for why it has its own port/database rather than reusing wrangler.test.toml).
BeforeAll({ timeout: 60_000 }, async () => {
  execSync(
    `npx wrangler d1 migrations apply rummikub-scores-cucumber-integration-db --local --config ${CONFIG}`,
    { stdio: "inherit" },
  );
  server = spawn("npx", ["wrangler", "dev", "--config", CONFIG, "--port", String(PORT)], { stdio: "inherit" });
  await waitForHealth(`http://localhost:${PORT}/api/health`);
});

AfterAll(() => {
  server?.kill();
});

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
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
