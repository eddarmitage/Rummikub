import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests: Vitest + React Testing Library against src/frontend/pages/.
//
// No test files currently live under tests/component/: the previous Home.tsx/Game.tsx
// placeholder tests were removed as part of #9 landing alongside #6/#7/#8's real
// create-game/scorecard/add-round implementations (testing the placeholder copy would've
// been stale the moment that PR merged). `passWithNoTests` keeps `npm run test` green in the
// meantime — replace it with real coverage of CreateGame/Game/AddRound as a fast-follow.
export default defineConfig({
  plugins: [react()],
  test: {
    name: "component",
    include: ["tests/component/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./tests/component/setup.ts"],
    passWithNoTests: true,
  },
});
