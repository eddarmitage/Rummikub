import { useCallback, useEffect, useState } from "react";
import { AddRound } from "./AddRound";
import { apiGet, ApiRequestError } from "../lib/api";
import { signIn } from "../lib/auth";
import { sortTiles } from "../lib/tiles";
import type { GameDetail } from "../lib/types";

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  return `${hours}:${minutes}${ampm}`;
}

/**
 * Scorecard screen (/g/:id) — docs/mockups/scorecard.png. Public read: anyone with the link
 * sees this exact screen, no visual difference between authenticated and anonymous viewers
 * (issue #7). The write action (adding a round) lives in the AddRound modal (#8).
 */
export function Game({ gameId }: { gameId: string }) {
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddRound, setShowAddRound] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<GameDetail>(`/games/${gameId}`);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.code === "GAME_NOT_FOUND"
          ? "That game doesn't exist."
          : "Couldn't load this game.",
      );
    }
  }, [gameId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the URL is still visible
      // in the address bar, so there's nothing more useful to do than silently no-op.
    }
  }

  if (error) {
    return (
      <main className="page">
        <div className="card">
          <p className="error">{error}</p>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="page">
        <div className="card">
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  const { game, players, rounds, totals } = detail;
  const totalsByPlayer = new Map(totals.map((t) => [t.playerId, t.total]));
  const currentRound = rounds.length + (game.status === "active" ? 1 : 0);

  return (
    <main className="page">
      <div className="card">
        <div className="card-header">
          <h1>{game.name || "Untitled game"}</h1>
          <span className={`badge badge-${game.status}`}>{game.status === "active" ? "Active" : "Complete"}</span>
        </div>
        <p className="subheading">
          Round {currentRound} · started {formatStartTime(game.createdAt)}
        </p>

        {players.length === 0 ? (
          <p className="empty-state">No players yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="scorecard-table">
              <thead>
                <tr>
                  <th>Round</th>
                  {players.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => {
                  const scoresByPlayer = new Map(round.scores.map((s) => [s.playerId, s]));
                  return (
                    <tr key={round.id}>
                      <td className="round-number">{round.roundNumber}</td>
                      {players.map((p) => {
                        const score = scoresByPlayer.get(p.id);
                        if (!score) return <td key={p.id}>–</td>;
                        return (
                          <td key={p.id}>
                            <div className="round-score">{formatSigned(score.roundScore)}</div>
                            <div className="round-score-tiles">
                              {score.tiles.length > 0 ? (
                                sortTiles(score.tiles).join(" ")
                              ) : (
                                <span className="winner-pill">winner</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td>Total</td>
                  {players.map((p) => (
                    <td key={p.id}>{formatSigned(totalsByPlayer.get(p.id) ?? 0)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {game.status === "active" && (
          <button type="button" className="button-primary" onClick={() => setShowAddRound(true)}>
            + Add round
          </button>
        )}

        <div className="button-row">
          <button type="button" className="button-outline" onClick={handleShare}>
            {shareCopied ? "Copied!" : "Share link"}
          </button>
          <button type="button" className="button-outline" onClick={() => signIn()}>
            Sign in
          </button>
        </div>
      </div>

      {showAddRound && (
        <AddRound
          gameId={gameId}
          players={players}
          roundNumber={currentRound}
          onClose={() => setShowAddRound(false)}
          onSaved={async () => {
            setShowAddRound(false);
            await load();
          }}
        />
      )}
    </main>
  );
}
