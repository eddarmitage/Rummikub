import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Home } from "../../src/frontend/pages/Home";

// Home is currently a scaffold placeholder (see issue #6 for the v1
// game-creation flow) — this test asserts what's actually on `main` today
// rather than the future UI.
describe("Home", () => {
  it("renders the app heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Rummikub scores" })).toBeInTheDocument();
  });

  it("renders the scaffold placeholder copy", () => {
    render(<Home />);
    expect(screen.getByText(/scaffold placeholder/i)).toBeInTheDocument();
  });
});
