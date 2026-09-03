Feature: Duplicate player names

  Player names must be unique within a game, case-insensitive and post-trim (#31,
  src/shared/lib/players.ts). The rejection itself is a real API contract, so -- same as
  round-scoring.feature -- the integration layer verifies it for real (workerd + D1) via raw
  HTTP, not a separate Vitest test: there's no second hand-written implementation of the check
  for a dedicated test to guard against drifting, and the component layer's stubbed fetch
  (tests/cucumber/component/hooks.ts) calls the same isDuplicatePlayerName() the route does,
  so it can't drift from it either.

  Scenario: A duplicate player name is rejected when creating a game
    When I try to create a game with players:
      | name  |
      | Alice |
      | alice |
    Then I should see the error "A player with that name already exists in this game."

  # Confirming the create-game form doesn't navigate away on that error is purely a frontend
  # concern -- like sign-in-prompt.feature's redirect check -- so this half is @no-integration.
  # The form validates player names itself before submitting anything (#51), so the duplicate is
  # caught before the game is ever created -- no orphaned game left behind for the user to lose
  # track of.
  @no-integration
  Scenario: The create-game form stays put after a duplicate-name rejection
    When I try to create a game with players:
      | name  |
      | Alice |
      | alice |
    Then I should still be on the create-game form
    And no game should have been created
