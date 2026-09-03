import { setWorldConstructor, World as CucumberWorld, type IWorldOptions } from "@cucumber/cucumber";
import type { RenderResult } from "@testing-library/react";

export interface FakePlayer {
  id: string;
  gameId: string;
  name: string;
  sortOrder: number;
}

export interface FakeScore {
  playerId: string;
  tiles: string[];
  roundScore: number;
}

export interface FakeRound {
  id: string;
  roundNumber: number;
  scores: FakeScore[];
}

/**
 * Per-scenario state for the component layer. There's no real backend here — hooks.ts stubs
 * `global.fetch` against this in-memory game, using the real computeRoundScores() (imported
 * from src/worker/lib/scoring.ts) so the fake responses stay honest without re-deriving the
 * scoring rules a second time in test code. This lets the component steps focus purely on
 * verifying Game.tsx/EnterRound.tsx's own rendering and wiring.
 */
export class ComponentWorld extends CucumberWorld {
  gameId = "game-1";
  players: FakePlayer[] = [];
  rounds: FakeRound[] = [];
  /** When true, the stubbed POST /rounds responds 401 UNAUTHENTICATED instead of saving. */
  simulateUnauthenticated = false;
  /** Rendered once per scenario and reused across "round N is played" steps — RTL's render()
   *  doesn't unmount a previous tree, so calling it again per round would leave duplicate
   *  <Game> trees in the document instead of advancing the same one. */
  view?: RenderResult;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(ComponentWorld);
