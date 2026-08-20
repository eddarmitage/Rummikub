import { defineConfig } from "vitest/config";

// Unit tests: pure logic (src/worker/lib/, src/worker/routes/schemas.ts) —
// plain Node, no Workers runtime, no D1.
export default defineConfig({
  test: {
    name: "unit",
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
