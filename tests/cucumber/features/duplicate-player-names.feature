Feature: Duplicate player names

  Player names must be unique within a game, case-insensitive and post-trim (#31). The
  create-game form (CreateGame.tsx) is the only place a player's name is entered -- it submits
  each player row through POST /games/:id/players in turn -- so this exercises the rejection as
  a user actually experiences it: the form stays put and shows the API's error message instead
  of navigating to the new game. Excluded from the integration layer with @no-integration --
  the API contract itself (status code, error shape) is already covered directly by
  tests/integration/games.test.ts; integration has no UI to check this against.

  @no-integration
  Scenario: A duplicate player name is rejected when creating a game
    When I try to create a game with players:
      | name  |
      | Alice |
      | alice |
    Then I should see the error "A player with that name already exists in this game."
    And I should still be on the create-game form
