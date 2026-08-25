Feature: Round scoring

  Scoring math lives in src/worker/lib/scoring.ts. The Add Round form also computes a
  lightweight per-player tile-value preview client-side (src/frontend/lib/tiles.ts), kept in
  sync with the server's rules by hand per that file's own header comment. These scenarios are
  untagged (run at all three layers: component, integration, e2e) specifically to catch those
  two implementations drifting apart, on top of confirming the real end-to-end wiring.

  Scenario: A round is entered and the running score updates
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
    When round 1 is played:
      | player | tiles |
      | Alice  | 1 2 3 |
      | Bob    |       |
    Then the score should show:
      | player | total |
      | Alice  | -6    |
      | Bob    | 6     |

  Scenario: Single round, one player goes out among three
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
      | Carol |
    When round 1 is played:
      | player | tiles |
      | Alice  |       |
      | Bob    | 5     |
      | Carol  | 10 J  |
    Then the score should show:
      | player | total |
      | Alice  | 45    |
      | Bob    | -5    |
      | Carol  | -40   |

  Scenario: Two-player round with a joker on the loser's rack
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
    When round 1 is played:
      | player | tiles |
      | Alice  |       |
      | Bob    | J     |
    Then the score should show:
      | player | total |
      | Alice  | 30    |
      | Bob    | -30   |

  # Mirrors scripts/seed.ts's DEMO_ROUND_SCORES, so this also doubles as a regression check on
  # the numbers shown in local dev.
  Scenario: Multi-round game, different winner each round, running totals
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
      | Carol |
    When round 1 is played:
      | player | tiles     |
      | Alice  | 3 9 J     |
      | Bob    |           |
      | Carol  | 4 13 12 5 |
    And round 2 is played:
      | player | tiles |
      | Alice  |       |
      | Bob    | 8     |
      | Carol  | 7 8   |
    Then the score should show:
      | player | total |
      | Alice  | -19   |
      | Bob    | 68    |
      | Carol  | -49   |

  Scenario: Tied fewest-tiles round (no bonus) followed by an outright win
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
      | Carol |
    When round 1 is played:
      | player | tiles |
      | Alice  | 5     |
      | Bob    | 5     |
      | Carol  | 1 2 3 |
    And round 2 is played:
      | player | tiles |
      | Alice  |       |
      | Bob    | 9     |
      | Carol  | 4     |
    Then the score should show:
      | player | total |
      | Alice  | 8     |
      | Bob    | -14   |
      | Carol  | -10   |

  # Tile order/labelling is a UI-only rendering concern (Game.tsx) with no server-side equivalent
  # to check against, so this scenario is excluded from the integration layer with
  # @no-integration -- unlike the scoring scenarios above, there's no API response for a bare
  # HTTP layer to inspect.
  @no-integration
  Scenario: A round's rack is shown sorted with jokers last, and the winner's rack reads "winner"
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
    When round 1 is played:
      | player | tiles         |
      | Alice  | 9 3 J 12 J 5  |
      | Bob    |               |
    Then the rack for "Alice" in round 1 should show "3 5 9 12 J J"
    And the rack for "Bob" in round 1 should show "winner"
