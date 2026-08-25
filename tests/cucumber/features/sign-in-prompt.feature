Feature: Sign-in is required to save a round

  Reads are public; writes require auth (AGENTS.md "Hard constraints"). The app deliberately
  does not hide the "Add round" button from anonymous visitors -- CreateGame.tsx's own
  comment: "auth follows the same auth-at-submit-time pattern ... rather than gating the
  form". It only prompts sign-in once a write actually fails. That prompt-and-redirect
  behaviour (src/frontend/lib/auth.ts's signIn()) exists only in the frontend, so this
  scenario is excluded from the integration layer with @no-integration -- the 401 it reacts
  to is already covered separately by tests/integration/rounds.test.ts.

  @no-integration
  Scenario: An anonymous visitor is prompted to sign in when saving a round
    Given a game with players:
      | name  |
      | Alice |
      | Bob   |
    When an anonymous visitor tries to play round 1:
      | player | tiles |
      | Alice  | 5     |
      | Bob    |       |
    Then they should be redirected to sign in
