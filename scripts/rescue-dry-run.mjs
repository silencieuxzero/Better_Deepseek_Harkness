// Dry-run of the rescue plan against the REAL web profile (read-only).
// Verifies: ext-center row untouched, third-party patch rows disabled,
// third-party bundle rows targeted, core bundles skipped.
// Requires `npm run build` first — it imports from the generated lib/.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import {
  buildRescuePlan,
  startupProblems,
  isThirdPartyPluginName,
  duplicateEntryIds,
  patchRowIds
} from "../lib/rescue.js";

const profileDir = process.argv[2];
if (!profileDir) {
  console.error("usage: node rescue-dry-run.mjs <profileDir>");
  process.exit(1);
}
const patchPath = join(profileDir, "cordis.patch.yml");
if (!existsSync(patchPath)) {
  console.error("no patch file:", patchPath);
  process.exit(1);
}

const OWN = "better-deepseek-harness";
const JsExpr = new yaml.Type("tag:yaml.org,2002:js", {
  kind: "scalar",
  resolve: (data) => typeof data === "string",
  construct: (data) => ({ __jsExpr: data }),
  predicate: (data) => data instanceof Object && "__jsExpr" in data,
  represent: (data) => data["__jsExpr"]
});
const patchSchema = yaml.JSON_SCHEMA.extend(JsExpr);
const loadedPatch = yaml.load(readFileSync(patchPath, "utf8"), { schema: patchSchema }) ?? [];
if (!Array.isArray(loadedPatch)) {
  console.error("patch file is not a top-level array:", patchPath);
  process.exit(1);
}
const list = loadedPatch;

const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
const bundles = manifest.dsh?.profile?.bundles ?? [];
const bundleLayers = [];
for (const name of bundles) {
  if (typeof name !== "string" || !isThirdPartyPluginName(name, OWN)) continue;
  let dir = null;
  try {
    const require = createRequire(join(profileDir, "package.json"));
    for (const searchPath of require.resolve.paths(name) ?? []) {
      const candidate = join(searchPath, name);
      if (existsSync(join(candidate, "package.json"))) { dir = candidate; break; }
    }
  } catch { /* ignore */ }
  if (!dir) {
    console.log(`bundle ${name}: NOT RESOLVABLE from profile — skipped`);
    continue;
  }
  const declared = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))?.dsh?.bundle?.patch;
  const patchPath2 = typeof declared === "string" ? resolve(dir, declared) : null;
  if (!patchPath2 || !existsSync(patchPath2)) {
    console.log(`bundle ${name}: no patch file — skipped`);
    continue;
  }
  const loadedRows = yaml.load(readFileSync(patchPath2, "utf8"), { schema: patchSchema }) ?? [];
  if (!Array.isArray(loadedRows)) {
    console.log(`bundle ${name}: patch is not a top-level array — skipped`);
    continue;
  }
  const rows = loadedRows;
  const rowIds = [];
  for (const row of rows) rowIds.push(...patchRowIds(row));
  console.log(`bundle ${name}: resolved -> dir=${dir}, rowIds=${JSON.stringify(rowIds)}`);
  bundleLayers.push({ name, rowIds });
}

console.log("\npatch rows:", list.length);
console.log("duplicate ids (patch+bundle):", duplicateEntryIds(list, bundleLayers.flatMap((l) => l.rowIds)));

const problems = startupProblems(list, new Map(), OWN, { includePending: false, extraIds: bundleLayers.flatMap((l) => l.rowIds) });
console.log("startup problems (no live entries):", problems);

const plan = buildRescuePlan(list, bundleLayers, OWN, new Map(), {
  kind: "crash",
  message: "dry run"
});
console.log("\nrescue plan:");
for (const plugin of plan.plugins) {
  console.log(`  - [${plugin.kind}] ${plugin.name} (reason=${plugin.reason.code}, ids=${JSON.stringify(plugin.rowIds)})`);
}
console.log("changed:", plan.changed);
if (plan.changed) {
  console.log("\nproposed patch (first 30 lines):");
  const text = yaml.dump(plan.updatedList, { schema: patchSchema, noRefs: true, lineWidth: 120, noCompatMode: true });
  console.log(text.split("\n").slice(0, 30).join("\n"));
}
