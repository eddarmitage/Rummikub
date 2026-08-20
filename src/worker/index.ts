import { Hono } from "hono";
import { auth } from "./routes/auth";
import { games } from "./routes/games";
import type { AuthVariables } from "./middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/games", games);
app.route("/api/auth", auth);

export default app;
