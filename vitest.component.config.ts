import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests: Vitest + React Testing Library against src/frontend/pages/.
//
// No test files currently live under tests/component/: the previous Home.tsx/Game.tsx
// placeholder tests were removed as part of #9 landing alongside #6/#7/#8's real
// create-game/scorecard/add-round implementations (testing the placeholder copy would've
// been stale the moment that PR merged). `passWithNoTests` keeps `npm run test` green in the
// meantime — replace it with real coverage of CreateGame/Game/EnterRound as a fast-follow.
export default defineConfig({
  plugins: [react()],
  test: {
    name: "component",
    // `.ts` as well as `.tsx`: this is the project's only jsdom-backed Vitest suite, so
    // DOM-touching frontend lib tests live here too, not just component tests.
    include: ["tests/component/**/*.test.ts", "tests/component/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./tests/component/setup.ts"],
    passWithNoTests: true,
  },
});
