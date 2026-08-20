import { defineConfig } from "vitest/config";

// Root aggregator — running `vitest` / `vitest run` from repo root picks up all
// three Vitest-based suites (unit, component, integration), each defined in
// its own config file since they need different environments/plugins (see
// AGENTS.md "Testing conventions"). Playwright e2e tests are separate — see
// playwright.config.ts and `npm run test:e2e`.
export default defineConfig({
  test: {
    projects: ["vitest.unit.config.ts", "vitest.component.config.ts", "vitest.integration.config.ts"],
  },
});
