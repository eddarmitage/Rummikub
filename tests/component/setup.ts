// Registers jest-dom's matchers (toBeInTheDocument, toHaveTextContent, ...)
// with Vitest's `expect`, and provides their TypeScript types.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unlike Jest, Vitest doesn't auto-register RTL's cleanup — without this,
// each test's rendered tree stays mounted into the next test's document.
afterEach(() => {
  cleanup();
});
