import { useEffect, useMemo, useState } from "react";
import { apiPatch, apiPost } from "../lib/api";
import { isUnauthenticatedError, signIn } from "../lib/auth";
import { parseTileInput, rackValue } from "../lib/tiles";
import type { Player, Round } from "../lib/types";

interface EnterRoundProps {
  gameId: string;
  players: Player[];
  roundNumber: number;
  /** When set, edits this previously-saved round instead of adding a new one (#52) — the form
   *  is pre-populated with its tiles and PATCHes rather than POSTs on save. */
  round?: Round;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Enter Round modal — docs/mockups/add-round.png (issue #8). Triggered from the Scorecard's
 * "Add round" button, or — pre-populated with an existing round's tiles — from a round row's
 * edit button (#52). This is the write action requiring auth; per the spec, sign-in is
 * prompted at save time rather than gating the modal from opening.
 *
 * Each player's remaining rack is entered as free text (e.g. "3 5 8 J 12"; leave blank if they
 * went out) — the server computes the actual round score from these tiles per official
 * Rummikub rules (src/worker/lib/scoring.ts). Exactly one player must go out per round (#50),
 * so submission is blocked — same treatment as an invalid tile token — unless exactly one rack
 * is blank; roundScoresSchema (src/worker/routes/schemas.ts) enforces the same rule server-side,
 * for both the add (POST) and edit (PATCH) routes.
 */
export function EnterRound({ gameId, players, roundNumber, round, onClose, onSaved }: EnterRoundProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!round) return {};
    const initial: Record<string, string> = {};
    for (const score of round.scores) initial[score.playerId] = score.tiles.join(" ");
    return initial;
  });
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
  const goneOutCount = [...parsedByPlayer.values()].filter((parsed) => parsed.ok && parsed.tiles.length === 0).length;
  const winnerHint = hasInvalidRow
    ? null
    : goneOutCount === 0
      ? "Exactly one player must go out — leave their rack blank to end the round."
      : goneOutCount > 1
        ? "Only one player can go out — leave just one rack blank."
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasInvalidRow || goneOutCount !== 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const scores = players.map((p) => {
        const parsed = parsedByPlayer.get(p.id);
        return { playerId: p.id, tiles: parsed?.ok ? parsed.tiles : [] };
      });
      if (round) {
        await apiPatch(`/games/${gameId}/rounds/${round.id}`, { scores });
      } else {
        await apiPost(`/games/${gameId}/rounds`, { scores });
      }
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
          <h2>{round ? `Edit round ${roundNumber}` : `Round ${roundNumber}`}</h2>
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

          {winnerHint && <p className="tile-hint tile-hint-error">{winnerHint}</p>}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button-primary" disabled={submitting || hasInvalidRow || goneOutCount !== 1}>
            Save round
          </button>
        </form>
      </div>
    </div>
  );
}
