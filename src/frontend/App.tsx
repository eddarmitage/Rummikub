import { Home } from "./pages/Home";
import { Game } from "./pages/Game";

// Hand-rolled routing: v1 has exactly one real route (the scorecard, /g/:id),
// so a router library isn't worth the dependency. Revisit if the route count grows.
export function App() {
  const match = window.location.pathname.match(/^\/g\/([^/]+)\/?$/);
  if (match) {
    return <Game gameId={match[1]} />;
  }
  return <Home />;
}
