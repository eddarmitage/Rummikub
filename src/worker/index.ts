import { Hono } from "hono";
import { auth } from "./routes/auth";
import { games } from "./routes/games";
import { isAuthEnabled, type AuthVariables } from "./middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Public runtime config for the frontend. Deliberately a plain GET with no `requireAuth()`, and
// deliberately absent from the Access destination table in README "Auth setup" — anonymous
// scorecard viewers must be able to read it too (AGENTS.md "Hard constraints": reads are public).
app.get("/api/config", (c) => c.json({ authEnabled: isAuthEnabled(c.env) }));

app.route("/api/games", games);
app.route("/api/auth", auth);

export default app;
