// Copy the hand-maintained JS sources to lib/ byte-identically. tsc reprints
// JS with its own formatting, so JS ships as exact copies while only the
// TypeScript sources are compiled. This keeps the generated lib/ diff minimal
// and guarantees the shipped runtime equals the reviewed src/.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../lib/", import.meta.url), { recursive: true });
for (const name of ["index.js", "client.js"]) {
  cpSync(new URL(`../src/${name}`, import.meta.url), new URL(`../lib/${name}`, import.meta.url));
}
