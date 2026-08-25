// Registers tsx's ESM loader so cucumber-js can `--import` .ts/.tsx step
// definitions directly (package.json "type": "module" means ESM, so this is
// the ESM-flavoured setup from tsx's cucumber-js integration guide, not the
// CommonJS `tsx/cjs` one).
import { register } from "tsx/esm/api";
register();
