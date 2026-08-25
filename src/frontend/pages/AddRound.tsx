import { useEffect, useMemo, useState } from "react";
import { apiPost } from "../lib/api";
import { isUnauthenticatedError, signIn } from "../lib/auth";
import { parseTileInput, rackValue } from "../lib/tiles";
import type { Player } from "../lib/types";

interface AddRoundProps {
  gameId: string;
  players: Player[];
  roundNumber: number;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add Round modal — docs/mockups/add-round.png (issue #8). Triggered from the Scorecard's
 * "Add round" button. This is the write action requiring auth; per the spec, sign-in is
 * prompted at save time rather than gating the modal from opening.
 *
 * Each player's remaining rack is entered as free text (e.g. "3 5 8 J 12"; leave blank if they
 * went out) — the server computes the actual round score from these tiles per official
 * Rummikub rules (src/worker/lib/scoring.ts).
 */
export function AddRound({ gameId, players, roundNumber, onClose, onSaved }: AddRoundProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const parsedByPlayer = useMemo(() => {
    const result = new Map<string, ReturnType<typeof parseTileInput>>();
    for (const p of players) result.set(p.id, parseTileInput(values[p.id] ?? ""));
    return result;
  }, [players, values]);

  const hasInvalidRow = [...parsedByPlayer.values()].some((parsed) => !parsed.ok);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasInvalidRow) return;
    setSubmitting(true);
    setError(null);
    try {
      const scores = players.map((p) => {
        const parsed = parsedByPlayer.get(p.id);
        return { playerId: p.id, tiles: parsed?.ok ? parsed.tiles : [] };
      });
      await apiPost(`/games/${gameId}/rounds`, { scores });
      onSaved();
    } catch (err) {
      if (isUnauthenticatedError(err)) {
        signIn();
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h2>Round {roundNumber}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="subheading">Tiles left on each player's rack — e.g. "3 5 8 12". Use J or * for a joker.</p>

        <form onSubmit={handleSubmit}>
          {players.map((p) => {
            const parsed = parsedByPlayer.get(p.id);
            return (
              <label className="round-player-row" key={p.id}>
                <span>{p.name}</span>
                <div className="round-player-input">
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="winner"
                    value={values[p.id] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  {parsed?.ok ? (
                    parsed.tiles.length > 0 && (
                      <span className="tile-hint">
                        {parsed.tiles.length} tile{parsed.tiles.length === 1 ? "" : "s"} · {rackValue(parsed.tiles)} pts
                      </span>
                    )
                  ) : (
                    <span className="tile-hint tile-hint-error">{parsed?.error}</span>
                  )}
                </div>
              </label>
            );
          })}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button-primary" disabled={submitting || hasInvalidRow}>
            Save round
          </button>
        </form>
      </div>
    </div>
  );
}
