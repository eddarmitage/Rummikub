import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Game } from "../../src/frontend/pages/Game";

// Game is currently a scaffold placeholder (see issue #7 for the scorecard
// screen) — this test asserts what's actually on `main` today rather than
// the future UI.
describe("Game", () => {
  it("renders a heading including the given gameId", () => {
    render(<Game gameId="aB3xK9mQ" />);
    expect(screen.getByRole("heading", { name: "Game aB3xK9mQ" })).toBeInTheDocument();
  });

  it("renders the scaffold placeholder copy", () => {
    render(<Game gameId="aB3xK9mQ" />);
    expect(screen.getByText(/scaffold placeholder/i)).toBeInTheDocument();
  });
});
