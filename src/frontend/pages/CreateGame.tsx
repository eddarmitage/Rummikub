import { useState } from "react";
import { apiPost } from "../lib/api";
import { isUnauthenticatedError, signIn } from "../lib/auth";
import type { Game, Player } from "../lib/types";
import { isDuplicatePlayerName } from "../../shared/lib/players";

const MIN_PLAYERS = 2;

/**
 * Root route ('/'). Deliberately not the spec's deferred "Home" screen (docs/spec.md "Home" —
 * that needs auth-derived identity for "your recent games" and is v2+). This is the minimal
 * standalone create-game form issue #6 decided on: game name + player names in one form, since
 * there's no other UI for adding players once a game exists. Creating a game is a write, so it
 * follows the same auth-at-submit-time pattern as Add Round (#8) rather than gating the form.
 */
export function CreateGame() {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validPlayerCount = players.filter((p) => p.trim().length > 0).length;
  const canSubmit = validPlayerCount >= MIN_PLAYERS && !submitting;

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerRow() {
    setPlayers((prev) => [...prev, ""]);
  }

  function removePlayerRow(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const trimmedPlayers = players.map((p) => p.trim()).filter((p) => p.length > 0);
    const seenPlayers: { name: string }[] = [];
    for (const playerName of trimmedPlayers) {
      if (isDuplicatePlayerName(seenPlayers, playerName)) {
        setError("A player with that name already exists in this game.");
        return;
      }
      seenPlayers.push({ name: playerName });
    }

    setSubmitting(true);
    setError(null);
    try {
      const trimmedName = name.trim();
      const { game } = await apiPost<{ game: Game }>("/games/new", trimmedName ? { name: trimmedName } : {});

      for (const [index, playerName] of trimmedPlayers.entries()) {
        await apiPost<{ player: Player }>(`/games/${game.id}/players`, { name: playerName, sortOrder: index });
      }

      window.location.href = `/g/${game.id}`;
    } catch (err) {
      if (isUnauthenticatedError(err)) {
        signIn("/");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Rummikub scores</h1>
        <p className="subheading">Track rounds, share the link, see who's winning.</p>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Game name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday game night"
              maxLength={200}
            />
          </label>

          <div className="player-rows">
            <span className="field-label">Players</span>
            {players.map((player, index) => (
              <div className="player-row" key={index}>
                <input
                  type="text"
                  value={player}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  placeholder={`Player ${index + 1}`}
                  maxLength={100}
                />
                {players.length > MIN_PLAYERS && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove player ${index + 1}`}
                    onClick={() => removePlayerRow(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="button-outline" onClick={addPlayerRow}>
              + Add player
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button-primary" disabled={!canSubmit}>
            + Start new game
          </button>
        </form>
      </div>
    </main>
  );
}
