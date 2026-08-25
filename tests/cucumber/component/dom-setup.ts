import { JSDOM } from "jsdom";

/**
 * Installs jsdom globals — must finish running before anything imports react-dom (transitively,
 * via Game.tsx in steps.ts). react-dom computes `isInputEventSupported` ONCE at its own
 * module-load time from the then-current `document`/`canUseDOM`; if that runs while
 * `globalThis.document` is still unset, it locks onto a legacy IE8 input-tracking shim
 * (handleEventsForInputEventPolyfill) that keeps *module-level* state (`activeElement$1`)
 * pointing at whatever jsdom element it last saw — and since that shim calls `.detachEvent()`,
 * which jsdom doesn't implement, every focus event after the first throws before updating that
 * state, so typed input silently stops reaching React for every scenario after the first.
 * (Confirmed by watching POST bodies come back with empty tiles from the second scenario on.)
 *
 * cucumber.json's component profile lists this file explicitly, ahead of hooks.ts/steps.ts, to
 * guarantee that ordering — a glob's file order isn't something to rely on for this.
 *
 * Mirrors tests/component/setup.ts's environment (Vitest's jsdom environment created once per
 * test file, not per test) rather than creating a fresh realm per scenario.
 */
export const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });

// jsdom's `location.href` setter is spec-unforgeable (real browsers refuse to let you redefine
// it too) and silently no-ops real navigation instead of updating `.href` — so
// `window.location.href = ...` (src/frontend/lib/auth.ts's signIn()) can't be observed directly.
// Wrap `window` in a Proxy that swaps in a plain, mutable stand-in for `location` only;
// everything else still delegates to the real jsdom window.
export const fakeLocation = { href: "/", pathname: "/", search: "" };
const windowProxy = new Proxy(dom.window, {
  get(target, prop, receiver) {
    if (prop === "location") return fakeLocation;
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

// Node has its own built-in read-only `navigator` global (since v21) — redefine rather than
// assign, or overwriting it throws "Cannot set property navigator of ... getter".
for (const [key, value] of Object.entries({ window: windowProxy, document: dom.window.document, navigator: dom.window.navigator })) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
