import { useEffect, useState } from "react";
import { apiPost } from "../lib/api";
import { isUnauthenticatedError, signIn } from "../lib/auth";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const scores = players.map((p) => ({
        playerId: p.id,
        tilesLeftValue: Math.max(0, Math.trunc(Number(values[p.id] || "0")) || 0),
      }));
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
        <p className="subheading">Tiles left on rack for each player</p>

        <form onSubmit={handleSubmit}>
          {players.map((p) => (
            <label className="round-player-row" key={p.id}>
              <span>{p.name}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={values[p.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </label>
          ))}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button-primary" disabled={submitting}>
            Save round
          </button>
        </form>
      </div>
    </div>
  );
}
