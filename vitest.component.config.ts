import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests: Vitest + React Testing Library against src/frontend/pages/.
export default defineConfig({
  plugins: [react()],
  test: {
    name: "component",
    include: ["tests/component/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./tests/component/setup.ts"],
  },
});
