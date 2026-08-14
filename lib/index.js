/**
 * better-deepseek-harness — host half.
 *
 * Provides the Extension Center for the DeepSeek Harness Web UI:
 *   - a settings namespace (`ext-center`) with the plugin's own preferences
 *   - an HTTP API under /ext/api backed by the host webServer
 *   - skill install/uninstall into the user skill root (~/.dsh/skills) plus a
 *     skill provider that surfaces configured custom skill directories
 *   - plugin install/uninstall/enable/disable by materializing packages into
 *     the shared profile module root (~/.dsh/profiles/node_modules) and
 *     editing the profile's cordis.patch.yml, which the boot HMR watcher
 *     reapplies live (no restart required for host rows; client bundles show
 *     up after a page refresh).
 *
 * The patch file is the single live source of the loader tree, so every
 * mutation here goes through one transactional writer (parse -> merge ->
 * atomic write). Package provenance is tracked in a sidecar state file
 * (.dsh-ext-center.json) next to the profile's cordis.patch.yml.
 *
 * @module dsh-extension-center
 */
import { fileURLToPath } from "node:url";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { repairToolArguments } from "./tool-args.js";

/* ─────────────────────────── constants ─────────────────────────── */

const NAME = "better-deepseek-harness";
const SETTINGS_NS = "ext-center";
const STATE_VERSION = 1;
const STATE_FILE = ".dsh-ext-center.json";
const PATCH_FILE = "cordis.patch.yml";
const BODY_LIMIT = 2 * 1024 * 1024; // 2 MiB
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PKG_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const CUSTOM_SKILL_RANK = 300; // matches dsh-skill-filesystem's custom dir rank
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const DEFAULTS = Object.freeze({
  allowLan: false,
  skillRoot: "",
  customSkillDirs: [],
  treeRoot: ""
});

/** Names skipped by the file tree browser (VCS dirs, dependency/artifact trees). */
const TREE_IGNORES = new Set([
  ".git", ".svn", ".hg", "node_modules", ".dsh", "dist", ".next",
  ".cache", ".turbo", "coverage", "__pycache__", ".DS_Store"
]);
/** Cap on entries returned for one tree directory (huge dirs stay responsive). */
const MAX_TREE_ENTRIES = 2000;

/** The `!!js` YAML dialect used by loader entry lists (round-trip safe). */
const JsExpr = new yaml.Type("tag:yaml.org,2002:js", {
  kind: "scalar",
  resolve: (data) => typeof data === "string",
  construct: (data) => ({ __jsExpr: data }),
  predicate: (data) => data instanceof Object && "__jsExpr" in data,
  represent: (data) => data["__jsExpr"]
});
const patchSchema = yaml.JSON_SCHEMA.extend(JsExpr);

const SettingsSchema = z.object({
  allowLan: z.boolean().default(DEFAULTS.allowLan),
  skillRoot: z.string().default(DEFAULTS.skillRoot),
  customSkillDirs: z.array(z.string()).default([]),
  treeRoot: z.string().default(DEFAULTS.treeRoot)
});

/* ─────────────────────────── errors ─────────────────────────── */

class ExtError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const err = (code, message) => new ExtError(code, message);

/* ─────────────────────────── path layout ─────────────────────────── */

function resolveLayout(ctx, config) {
  const baseUrl = ctx.baseUrl;
  if (typeof baseUrl !== "string") throw err("layout", "ctx.baseUrl is not set — cannot resolve the profile directory");
  const profileDir = fileURLToPath(new URL(".", baseUrl));
  const dshHome = resolveDshHome();
  const profilesDir = dirname(profileDir);
  const pluginRoot = config.pluginRoot
    ? resolve(String(config.pluginRoot))
    : join(profilesDir, "node_modules");
  const patchFile = join(profileDir, PATCH_FILE);
  const stateFile = join(profileDir, STATE_FILE);
  const manifestFile = join(profileDir, "package.json");
  const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), ".agents");
  return {
    profileDir,
    dshHome,
    profilesDir,
    pluginRoot,
    patchFile,
    stateFile,
    manifestFile,
    agentsHome,
    defaultSkillRoot: join(dshHome, "skills")
  };
}

function readConfig(ctx, layout) {
  let stored = {};
  try {
    const settings = ctx.get("settings");
    const value = settings && typeof settings.get === "function" ? settings.get(SETTINGS_NS) : void 0;
    if (value && typeof value === "object") stored = value;
  } catch { /* settings service is optional */ }
  return { ...DEFAULTS, ...stored };
}

function skillRootsOf(layout, config) {
  const roots = [];
  const add = (root, source) => {
    const abs = resolve(root);
    if (!roots.some((r) => r.path === abs)) roots.push({ path: abs, source });
  };
  if (config.skillRoot) add(config.skillRoot, "custom");
  else add(layout.defaultSkillRoot, "user-dsh");
  add(join(layout.agentsHome, "skills"), "user-agents");
  for (const dir of config.customSkillDirs) add(dir, "custom");
  return roots;
}

/* ─────────────────────────── patch file ─────────────────────────── */

function loadPatchList(layout) {
  let raw;
  try {
    raw = readFileSync(layout.patchFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw err("patch-read", `cannot read ${layout.patchFile}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = yaml.load(raw, { schema: patchSchema });
  } catch (error) {
    throw err("patch-invalid", `${layout.patchFile} is not valid YAML: ${error.message}`);
  }
  if (parsed === void 0) return [];
  if (!Array.isArray(parsed)) throw err("patch-invalid", `${layout.patchFile} must be a top-level YAML array`);
  return parsed;
}

/** Preserve the file's leading comment block (the shipped template header). */
function headerComments(raw) {
  const lines = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) lines.push(line);
    else if (/^\s*$/.test(line)) lines.push(line);
    else break;
  }
  return lines;
}

const PATCH_WRITE_GAP_MS = 800;
let lastPatchWriteAt = 0;

function savePatchList(layout, list, previousRaw) {
  const header = headerComments(previousRaw);
  const body = yaml.dump(list, { schema: patchSchema, noRefs: true, lineWidth: 120, noCompatMode: true });
  const text = [...header, body].join("\n").replace(/\n+$/, "\n");
  const tmp = layout.patchFile + ".tmp";
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, layout.patchFile);
}

/**
 * Serialize patch-file writes: the harness config watcher can wedge when two
 * refreshes overlap, so successive writes are spaced by a small gap. Returns
 * the write promise (settled after the gap + write).
 */
async function serializePatchWrite(layout, list, raw) {
  const wait = Math.max(0, PATCH_WRITE_GAP_MS - (Date.now() - lastPatchWriteAt));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  savePatchList(layout, list, raw);
  lastPatchWriteAt = Date.now();
}

/** Poll the live loader until the predicate holds (or timeout). */
async function waitForLoaderState(ctx, predicate, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const loader = ctx.get("loader");
      if (loader && typeof loader.entries === "function" && predicate(loader.entries())) return true;
    } catch { /* loader inspection is best-effort */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function entrySignature(entry) {
  // canonical identity for dedupe / matching: id+name (+name of grouped rows)
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    if (entry.insert) return `insert:${JSON.stringify(entry.insert)}`;
    return `row:${String(entry.id ?? "")}:${String(entry.name ?? "")}`;
  }
  return JSON.stringify(entry);
}

function deepEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Append patch entries, skipping entries already present (by deep equality)
 * and insert-rows whose id already exists anywhere in the composition
 * (duplicate row ids would break the loader tree).
 */
function mergePatchEntries(list, rows, existingIds) {
  const added = [];
  for (const row of rows) {
    if (list.some((existing) => deepEqualJson(existing, row))) continue;
    if (Array.isArray(row.insert)) {
      const freshRows = Array.isArray(row.insert)
        ? row.insert.filter((entry) => !(entry && typeof entry === "object" && entry.id && existingIds.has(String(entry.id))))
        : row.insert;
      if (freshRows.length === 0) continue;
      const merged = { ...row, insert: freshRows };
      list.push(merged);
      added.push(merged);
      for (const entry of freshRows) if (entry && entry.id) existingIds.add(String(entry.id));
    } else {
      list.push(row);
      added.push(row);
    }
  }
  return added;
}

/* ─────────────────────────── sidecar state ─────────────────────────── */

function loadState(layout) {
  try {
    const parsed = JSON.parse(readFileSync(layout.stateFile, "utf8"));
    if (parsed && parsed.version === STATE_VERSION && parsed.plugins && typeof parsed.plugins === "object") return parsed.plugins;
  } catch { /* absent or malformed */ }
  return {};
}

function saveState(layout, plugins) {
  writeFileSync(layout.stateFile, JSON.stringify({ version: STATE_VERSION, plugins }, null, 2) + "\n", "utf8");
}

/* ─────────────────────────── skills ─────────────────────────── */

function parseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf("\n");
  if (firstLineEnd < 0) return null;
  if (raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return null;
  const start = firstLineEnd + 1;
  let lineStart = start;
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf("\n", lineStart);
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
      const bodyStart = nextNewline < 0 ? raw.length : nextNewline + 1;
      let data;
      try {
        data = yaml.load(raw.slice(start, lineStart), { schema: yaml.JSON_SCHEMA });
      } catch {
        return null;
      }
      if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
      return { data, body: raw.slice(bodyStart) };
    }
    if (nextNewline < 0) return null;
    lineStart = nextNewline + 1;
  }
  return null;
}

function frontmatterString(data, key) {
  const value = data[key];
  return typeof value === "string" ? value : void 0;
}

function readSkillFile(filePath) {
  if (!existsSync(filePath)) return void 0;
  const raw = readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) return void 0;
  const name = frontmatterString(parsed.data, "name");
  const description = frontmatterString(parsed.data, "description");
  if (!name || !SKILL_NAME_RE.test(name) || !description) return void 0;
  return {
    name,
    description,
    whenToUse: frontmatterString(parsed.data, "whenToUse"),
    content: parsed.body.trim(),
    path: filePath,
    dir: dirname(filePath)
  };
}

function listSkills(layout, config) {
  const skills = [];
  for (const root of skillRootsOf(layout, config)) {
    let entries = [];
    try {
      entries = readdirSync(root.path, { withFileTypes: true });
    } catch {
      continue; // absent root = no skills
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(root.path, entry.name);
      let skill;
      if (entry.isDirectory()) skill = readSkillFile(join(full, "SKILL.md"));
      else if (entry.isFile() && entry.name.endsWith(".md")) skill = readSkillFile(full);
      if (!skill) continue;
      skills.push({
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse ? { whenToUse: skill.whenToUse } : {}),
        source: root.source,
        path: skill.path
      });
    }
  }
  return skills;
}

function validateSkillText(text, requestedName) {
  const parsed = parseFrontmatter(text);
  if (!parsed) throw err("skill-invalid", "The skill file must start with YAML frontmatter (--- ... ---).");
  const data = { ...parsed.data };
  const name = frontmatterString(data, "name");
  const description = frontmatterString(data, "description");
  if (!description) throw err("skill-invalid", "Frontmatter requires a \"description\" field.");
  if (name !== void 0 && requestedName !== void 0 && name !== requestedName) {
    throw err("skill-invalid", `Frontmatter name \"${name}\" does not match the requested name \"${requestedName}\".`);
  }
  const finalName = name ?? requestedName;
  if (!finalName || !SKILL_NAME_RE.test(finalName)) {
    throw err("skill-invalid", `Invalid skill name \"${String(finalName)}\". Use lowercase kebab-case (e.g. my-skill).`);
  }
  if (name === void 0) {
    // inject the name so the file is self-contained
    const head = text.slice(0, parsed.body ? text.length - parsed.body.length : text.length);
    text = head.replace(/^(description\s*:\s*[^\n]*\n)/m, `$1name: ${finalName}\n`) + (parsed.body ?? "");
  }
  return { name: finalName, text };
}

async function fetchText(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  } catch (error) {
    throw err("download-failed", `failed to download ${url}: ${error.message}`);
  }
  if (!res.ok) throw err("download-failed", `download of ${url} returned HTTP ${res.status}`);
  return await res.text();
}

/* ─────────────────────────── plugins ─────────────────────────── */

function packageDirFor(pluginRoot, name) {
  return name.startsWith("@") ? join(pluginRoot, name.split("/")[0], name.split("/")[1]) : join(pluginRoot, name);
}

function readPackageManifest(dir) {
  const file = join(dir, "package.json");
  if (!existsSync(file)) throw err("package-invalid", `${file} does not exist — not an npm package`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw err("package-invalid", `${file} is not valid JSON: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || typeof manifest.name !== "string") {
    throw err("package-invalid", `${file} must declare a string \"name\"`);
  }
  if (!PKG_NAME_RE.test(manifest.name)) throw err("package-invalid", `package name \"${manifest.name}\" is not a valid npm name`);
  return manifest;
}

/** Minimal ustar/tar extraction (handles gzip, pax headers, long names via GNU 'L'). */
function untar(buffer, dest) {
  let offset = 0;
  const readStr = (start, len) => {
    let end = start + len;
    while (end > start && buffer[end - 1] === 0) end -= 1;
    return buffer.toString("utf8", start, end);
  };
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = readStr(offset, 100);
    const size = parseInt(readStr(offset + 124, 12).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] ?? 48);
    const prefix = readStr(offset + 345, 155);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) throw err("archive-invalid", "truncated tar archive");
    let targetName = prefix ? `${prefix}/${name}` : name;
    if (type === "L") {
      // GNU long name extension: payload is the real name
      const longName = buffer.toString("utf8", dataStart, dataEnd).replace(/\0+$/, "");
      offset = dataEnd + ((512 - (size % 512)) % 512);
      // The next header carries the actual content under the long name.
      const nextHeader = buffer.subarray(offset, offset + 512);
      const nextName = readStr(offset, 100);
      const nextSize = parseInt(readStr(offset + 124, 12).trim() || "0", 8) || 0;
      const nextType = String.fromCharCode(nextHeader[156] ?? 48);
      const nextDataStart = offset + 512;
      const nextDataEnd = nextDataStart + nextSize;
      if (nextType === "0" || nextType === "\0" || nextType === "") {
        const target = resolve(join(dest, longName));
        if (!target.startsWith(resolve(dest) + sep) && target !== resolve(dest)) throw err("archive-invalid", `unsafe tar path: ${longName}`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, buffer.subarray(nextDataStart, nextDataEnd));
      }
      offset = nextDataEnd + ((512 - (nextSize % 512)) % 512);
      continue;
    }
    const target = resolve(join(dest, targetName));
    if (target !== resolve(dest) && !target.startsWith(resolve(dest) + sep)) throw err("archive-invalid", `unsafe tar path: ${targetName}`);
    if (type === "5") {
      mkdirSync(target, { recursive: true });
    } else if (type === "0" || type === "\0" || type === "") {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer.subarray(dataStart, dataEnd));
    }
    // 'x'/'g' pax headers, hard links, symlinks etc. are skipped (content ignored)
    offset = dataEnd + ((512 - (size % 512)) % 512);
  }
}

async function downloadTarball(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: "follow" });
  } catch (error) {
    throw err("download-failed", `failed to download ${url}: ${error.message}`);
  }
  if (!res.ok) throw err("download-failed", `download of ${url} returned HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return /\bgzip\b/i.test(res.headers.get("content-encoding") ?? "") ? gunzipSync(buf) : buf;
}

async function npmTarballUrl(spec) {
  const at = spec.lastIndexOf("@");
  const hasScope = spec.startsWith("@");
  const version = hasScope ? (at > spec.indexOf("/") ? spec.slice(at + 1) : void 0) : (at > 0 ? spec.slice(at + 1) : void 0);
  const name = version === void 0 ? spec : spec.slice(0, spec.length - version.length - 1);
  const encoded = name.startsWith("@") ? `@${encodeURIComponent(name.slice(1).split("/")[0])}/${encodeURIComponent(name.split("/")[1])}` : encodeURIComponent(name);
  const url = version === void 0 ? `https://registry.npmjs.org/${encoded}` : `https://registry.npmjs.org/${encoded}/${encodeURIComponent(version)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow", headers: { accept: "application/json" } });
  } catch (error) {
    throw err("registry-failed", `failed to reach the npm registry: ${error.message}`);
  }
  if (!res.ok) throw err("registry-failed", `npm registry returned HTTP ${res.status} for ${name}`);
  const json = await res.json();
  const dist = json.dist;
  if (!dist || typeof dist.tarball !== "string") throw err("registry-failed", `no tarball available for ${name}`);
  return { name, version: json.version, tarball: dist.tarball };
}

async function materializePackage(source, stagingDir) {
  mkdirSync(stagingDir, { recursive: true });
  switch (source.kind) {
    case "folder": {
      const src = resolve(String(source.path ?? ""));
      if (!existsSync(src) || !statSync(src).isDirectory()) throw err("source-not-found", `folder not found: ${source.path}`);
      cpSync(src, stagingDir, { recursive: true });
      break;
    }
    case "url": {
      const buf = await downloadTarball(String(source.url ?? ""));
      untar(buf, stagingDir);
      break;
    }
    case "git": {
      const url = String(source.url ?? "");
      if (!url) throw err("source-invalid", "git source requires a url");
      const r = spawnSync("git", ["clone", "--depth", "1", url, stagingDir], { encoding: "utf8", timeout: 180_000 });
      if (r.error && r.error.code === "ENOENT") throw err("git-unavailable", "git is not installed on this machine — use a folder, tarball URL, or npm spec instead");
      if (r.status !== 0) throw err("git-failed", `git clone failed: ${String(r.stderr || r.stdout || "").slice(0, 800)}`);
      break;
    }
    case "npm": {
      const { tarball } = await npmTarballUrl(String(source.spec ?? ""));
      const buf = await downloadTarball(tarball);
      untar(buf, stagingDir);
      break;
    }
    default:
      throw err("source-invalid", `unknown source kind \"${source.kind}\"`);
  }
  // npm tarballs wrap content in a top-level "package/" directory
  const wrapped = join(stagingDir, "package");
  if (existsSync(join(wrapped, "package.json"))) {
    for (const entry of readdirSync(wrapped)) renameSync(join(wrapped, entry), join(stagingDir, entry));
    rmSync(wrapped, { recursive: true, force: true });
  }
  return readPackageManifest(stagingDir);
}

function bundlePatchRows(pkgDir) {
  let manifest;
  try {
    manifest = readPackageManifest(pkgDir);
  } catch {
    return [];
  }
  const rel = manifest.dsh && typeof manifest.dsh === "object" ? manifest.dsh.bundle?.patch : void 0;
  if (typeof rel !== "string") return [];
  const abs = resolve(pkgDir, rel);
  if (!existsSync(abs)) return [];
  let parsed;
  try {
    parsed = yaml.load(readFileSync(abs, "utf8"), { schema: patchSchema });
  } catch (error) {
    throw err("bundle-patch-invalid", `${abs} is not valid YAML: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw err("bundle-patch-invalid", `${abs} must be a top-level YAML array`);
  return parsed;
}

/* ─────────────────────────── skill provider ─────────────────────────── */

function registerSkillProvider(ctx, layout, configOf) {
  const skills = ctx.get("skills");
  if (!skills || typeof skills.registerProvider !== "function") return;
  const provider = {
    name: NAME,
    async list() {
      const config = configOf();
      const candidates = [];
      for (const dir of config.customSkillDirs) {
        const root = resolve(dir);
        let entries = [];
        try {
          entries = readdirSync(root, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          const full = join(root, entry.name);
          const skill = entry.isDirectory()
            ? readSkillFile(join(full, "SKILL.md"))
            : entry.isFile() && entry.name.endsWith(".md") ? readSkillFile(full) : void 0;
          if (!skill) continue;
          candidates.push({
            name: skill.name,
            description: skill.description,
            ...(skill.whenToUse ? { whenToUse: skill.whenToUse } : {}),
            invocation: { modelInvocable: true, userInvocable: true },
            provider: provider.name,
            source: "custom",
            rank: CUSTOM_SKILL_RANK,
            locator: { path: skill.path },
            resourceBase: { kind: "directory", path: skill.dir },
            path: skill.path
          });
        }
      }
      return candidates;
    },
    async get(candidate) {
      const skill = readSkillFile(candidate.path);
      if (!skill) return void 0;
      return {
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse ? { whenToUse: skill.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: "custom",
        provider: provider.name,
        resourceBase: { kind: "directory", path: skill.dir },
        path: skill.path,
        content: skill.content
      };
    }
  };
  ctx.skills.registerProvider(() => provider);
  ctx.logger?.info("extension-center: skill provider registered for custom directories");
}

/* ─────────────────────────── plugin lifecycle ─────────────────────────── */

function profileManifest(layout) {
  try {
    return JSON.parse(readFileSync(layout.manifestFile, "utf8"));
  } catch {
    return { name: basename(layout.profileDir), private: true, dependencies: {}, dsh: { profile: { bundles: [] } } };
  }
}

function saveProfileManifest(layout, manifest) {
  const text = JSON.stringify(manifest, null, 2) + "\n";
  const tmp = layout.manifestFile + ".tmp";
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, layout.manifestFile);
}

/**
 * Apply the enabled/disabled flag to the patch-list copies of the tracked
 * rows (the sidecar rows are snapshots; only the live list matters).
 * @returns the change verdict and the row shapes as they now appear in the
 *   list, so the sidecar can stay in sync with the patch file.
 */
function applyPluginDisabled(list, rows, disabled) {
  const updatedRows = [];
  let changed = false;
  for (const row of rows) {
    let at = list.findIndex((existing) => deepEqualJson(existing, row));
    if (at === -1) at = list.findIndex((existing) => entrySignature(existing) === entrySignature(row));
    if (at === -1) {
      updatedRows.push(row);
      continue;
    }
    const target = list[at];
    let mutated = false;
    if (Array.isArray(target.insert)) {
      for (const entry of target.insert) {
        if (entry && typeof entry === "object") {
          if (disabled && entry.disabled !== true) {
            entry.disabled = true;
            mutated = true;
          } else if (!disabled && entry.disabled === true) {
            delete entry.disabled;
            mutated = true;
          }
        }
      }
    } else if (target && typeof target === "object") {
      if (disabled && target.disabled !== true) {
        target.disabled = true;
        mutated = true;
      } else if (!disabled && target.disabled === true) {
        delete target.disabled;
        mutated = true;
      }
    }
    if (mutated) changed = true;
    updatedRows.push(target);
  }
  return { changed, updatedRows };
}

/* ─────────────────────────── HTTP layer ─────────────────────────── */

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > BODY_LIMIT) {
        reject(err("payload-too-large", `request body exceeds ${BODY_LIMIT} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text.trim()) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(text));
      } catch (error) {
        reject(err("bad-request", `invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? "";
  return LOOPBACK.has(address) || address.startsWith("::ffff:127.");
}

/* ─────────────────────────── the plugin ─────────────────────────── */

const inject = ["webServer", "tools"];

function apply(ctx, config = {}) {
  const layout = resolveLayout(ctx, config);
  const configOf = () => readConfig(ctx, layout);

  // 0. tool-call argument repair: the model occasionally drops `description` or
  //    emits arguments as unparseable JSON — repair before registry validation
  //    turns that into an INVALID_ARGS failure (see tool-args.js).
  if (typeof ctx.on === "function") try {
    ctx.on("tools/execute", async (exec, next) => {
      try {
        const definition = ctx.tools && typeof ctx.tools.get === "function"
          ? ctx.tools.get(exec.name, exec.agent)
          : void 0;
        const { arguments: repaired, changed } = repairToolArguments(definition?.parameters, exec.arguments);
        if (changed) {
          // prepare froze the original arguments snapshot; replace the reference
          // (exec itself is mutable — see dsh-tool-call-timeout-policy).
          exec.arguments = repaired;
          ctx.logger?.debug?.("extension-center: repaired arguments for tool %s", exec.name);
        }
      } catch (error) {
        // the repair layer must never break dispatch
        ctx.logger?.warn?.("extension-center: tool argument repair failed: %s", error?.message ?? error);
      }
      return next();
    });
    ctx.logger?.info?.("extension-center: tools/execute argument-repair wrapper registered");
  } catch (error) {
    ctx.logger?.warn?.("extension-center: tools/execute wrapper registration failed: %s", error?.message ?? error);
  }

  // 1. settings namespace (native preferences)
  const settings = ctx.get("settings");
  if (settings && typeof settings.register === "function") {
    settings.register(SETTINGS_NS, SettingsSchema, { base: DEFAULTS });
  }

  // 2. skill provider for custom directories
  try {
    registerSkillProvider(ctx, layout, configOf);
  } catch (error) {
    ctx.logger?.warn("extension-center: skill provider registration failed: %s", error.message);
  }

  // 3. HTTP API
  const handle = async (req, res) => {
    let url;
    try {
      url = new URL(req.url || "/", "http://ext");
    } catch {
      return send(res, 400, { ok: false, error: { code: "bad-request", message: "invalid path" } });
    }
    const pathname = decodeURIComponent(url.pathname);
    const route = routes[pathname];
    if (!route) return send(res, 404, { ok: false, error: { code: "not-found", message: pathname } });
    if (route.method !== req.method) return send(res, 405, { ok: false, error: { code: "method-not-allowed", message: req.method } });
    if ((route.mutating || route.requiresLocal) && !isLoopback(req) && !configOf().allowLan) {
      const message = route.requiresLocal
        ? "the file tree is loopback-only unless ext-center.allowLan is enabled"
        : "mutations are loopback-only unless ext-center.allowLan is enabled";
      return send(res, 403, { ok: false, error: { code: "forbidden", message } });
    }
    let body = {};
    try {
      if (route.readsBody) body = await readBody(req);
    } catch (error) {
      return send(res, 400, { ok: false, error: { code: error.code || "bad-request", message: error.message } });
    }
    try {
      const value = await route.handler(body, layout, configOf, ctx, url.searchParams);
      send(res, 200, { ok: true, value });
    } catch (error) {
      ctx.logger?.warn("extension-center: %s failed: %s", pathname, error.message);
      send(res, 200, { ok: false, error: { code: error.code || "internal", message: error.message } });
    }
  };
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: "/ext/api", handler: handle }), "extension-center: api routes");
  ctx.logger?.info("extension-center: API mounted at /ext/api (profile %s)", layout.profileDir);
}

/* ─────────────────────────── file tree ─────────────────────────── */

/**
 * Resolve the file tree root. Priority:
 *   1. an explicit `ext-center.treeRoot` setting;
 *   2. the most recently registered workspace (`ctx.workspaceRegistry`,
 *      newest-first durable order — the directory the user last worked in);
 *   3. the harness process working directory.
 */
function resolveTreeRoot(ctx, layout, configOf) {
  const config = configOf();
  if (config.treeRoot) return resolve(String(config.treeRoot));
  const workspace = resolveWorkspaceRoot(ctx);
  if (workspace) return workspace;
  return process.cwd();
}

/** The newest registered workspace path, or undefined when none is available. */
function resolveWorkspaceRoot(ctx) {
  try {
    const registry = ctx && typeof ctx.get === "function" ? ctx.get("workspaceRegistry") : void 0;
    if (registry && typeof registry.list === "function") {
      const workspaces = registry.list();
      if (Array.isArray(workspaces) && workspaces.length > 0) {
        const root = workspaces[0] && typeof workspaces[0] === "object" ? workspaces[0].path : void 0;
        if (typeof root === "string" && root.length > 0) return root;
      }
    }
  } catch { /* workspace registry is optional */ }
  return void 0;
}

function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * List one directory for the file tree. A relative `path` resolves against
 * the tree root; absolute paths must stay inside it (both a plain resolve
 * check and a realpath check, so `..` tricks and junction escapes fail).
 */
function listTreeDir(body, layout, configOf, ctx, query) {
  const root = resolveTreeRoot(ctx, layout, configOf);
  const want = query && typeof query.get === "function" ? String(query.get("path") || "") : "";
  const dir = want ? resolve(root, want) : root;
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw err("tree-outside-root", "tree path must stay inside the configured root");
  }
  const rootReal = realpathSafe(root);
  const dirReal = realpathSafe(dir);
  if (rootReal && dirReal && dirReal !== rootReal && !dirReal.startsWith(rootReal + sep)) {
    throw err("tree-outside-root", "tree path resolves outside the configured root");
  }
  let dirents;
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    throw err("tree-read", "cannot read " + dir + ": " + error.message);
  }
  const entries = [];
  for (const entry of dirents) {
    const name = entry.name;
    if (TREE_IGNORES.has(name)) continue;
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue; // vanished or unreadable between readdir and stat
    }
    const isDir = stat.isDirectory();
    entries.push({
      name,
      path: full,
      type: isDir ? "dir" : "file",
      size: isDir ? 0 : stat.size,
      mtime: Math.floor(stat.mtimeMs),
      children: isDir ? countTreeChildren(full) : 0
    });
  }
  entries.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
  const truncated = entries.length > MAX_TREE_ENTRIES;
  if (truncated) entries.length = MAX_TREE_ENTRIES;
  return { root, dir, name: basename(dir) || dir, entries, truncated };
}

/** Count non-ignored entries inside one directory (cheap badge for the tree). */
function countTreeChildren(dir) {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!TREE_IGNORES.has(entry.name)) count += 1;
    }
  } catch { /* unreadable dir: report 0 */ }
  return count;
}

/* ─────────────────────────── route handlers ─────────────────────────── */

function snapshotState(layout, configOf, ctx) {
  const config = configOf();
  const state = loadState(layout);
  const manifest = profileManifest(layout);
  const entries = [];
  try {
    const loader = ctx.get("loader");
    if (loader && typeof loader.entries === "function") {
      for (const entry of loader.entries()) {
        if (entry.options?.group) continue;
        entries.push({
          entryId: entry.id,
          moduleName: entry.options?.name ?? "",
          enabled: !entry.disabled,
          fiberPhase: entry.fiber ? ["pending", "loading", "active", "failed", "disposed", "unloading"][entry.fiber.state] ?? "unobserved" : null
        });
      }
    }
  } catch { /* loader inspection is best-effort */ }
  const installed = Object.entries(state).map(([name, record]) => ({
    name,
    version: record.version ?? "",
    source: record.source ?? null,
    enabled: !(record.disabled === true),
    builtin: record.builtin === true,
    rows: Array.isArray(record.rows) ? record.rows.length : 0
  })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    name: NAME,
    version: "0.1.0",
    dshHome: layout.dshHome,
    profileDir: layout.profileDir,
    pluginRoot: layout.pluginRoot,
    patchFile: layout.patchFile,
    skillRoots: skillRootsOf(layout, config).map((r) => ({ path: r.path, source: r.source })),
    config,
    skills: listSkills(layout, config),
    plugins: {
      entries,
      installed,
      bundles: Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [],
      dependencies: Object.keys(manifest.dependencies ?? {})
    }
  };
}

const routes = {
  "/ext/api/state": {
    method: "GET",
    readsBody: false,
    mutating: false,
    handler: (body, layout, configOf, ctx) => snapshotState(layout, configOf, ctx)
  },
  "/ext/api/tree": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, layout, configOf, ctx, query) => listTreeDir(body, layout, configOf, ctx, query)
  },
  "/ext/api/config": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf, ctx) => {
      const settings = ctx.get("settings");
      if (!settings || typeof settings.update !== "function") throw err("settings-unavailable", "the settings service is not mounted");
      const patch = {};
      for (const key of ["allowLan", "skillRoot", "customSkillDirs", "treeRoot"]) {
        if (key in body) {
          const value = body[key];
          if (key === "allowLan" && typeof value !== "boolean") throw err("bad-request", "allowLan must be a boolean");
          if (key === "skillRoot" && typeof value !== "string") throw err("bad-request", "skillRoot must be a string");
          if (key === "treeRoot" && typeof value !== "string") throw err("bad-request", "treeRoot must be a string");
          if (key === "customSkillDirs" && (!Array.isArray(value) || value.some((v) => typeof v !== "string"))) throw err("bad-request", "customSkillDirs must be an array of strings");
          patch[key] = value;
        }
      }
      await settings.update(SETTINGS_NS, patch);
      const skills = ctx.get("skills");
      if (skills && typeof skills.invalidateCache === "function") skills.invalidateCache();
      return snapshotState(layout, configOf, ctx);
    }
  },
  "/ext/api/skill/install": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf, ctx) => {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || !SKILL_NAME_RE.test(name)) throw err("bad-request", `invalid skill name \"${name}\". Use lowercase kebab-case.`);
      const config = configOf();
      const root = config.skillRoot ? resolve(config.skillRoot) : layout.defaultSkillRoot;
      mkdirSync(root, { recursive: true });
      const targetDir = join(root, name);
      const targetFile = join(root, name + ".md");
      if (existsSync(targetDir) || existsSync(targetFile)) throw err("already-exists", `a skill named \"${name}\" is already installed`);
      const modes = [body.text !== void 0, typeof body.url === "string", typeof body.path === "string"].filter(Boolean).length;
      if (modes !== 1) throw err("bad-request", "provide exactly one of text, url, or path");
      if (body.path !== void 0) {
        const src = resolve(String(body.path));
        if (!existsSync(src)) throw err("source-not-found", `path not found: ${body.path}`);
        const stat = statSync(src);
        if (stat.isDirectory()) {
          const skill = readSkillFile(join(src, "SKILL.md"));
          if (!skill) throw err("skill-invalid", `${src} must contain SKILL.md with name/description frontmatter`);
          if (skill.name !== name) throw err("skill-invalid", `SKILL.md declares name \"${skill.name}\" — expected \"${name}\"`);
          cpSync(src, targetDir, { recursive: true });
        } else if (stat.isFile() && src.endsWith(".md")) {
          const text = readFileSync(src, "utf8");
          const checked = validateSkillText(text, name);
          writeFileSync(targetFile, checked.text, "utf8");
        } else {
          throw err("skill-invalid", "path must point to a folder containing SKILL.md or a .md skill file");
        }
      } else {
        const text = body.text !== void 0 ? String(body.text) : await fetchText(String(body.url));
        const checked = validateSkillText(text, name);
        writeFileSync(targetFile, checked.text, "utf8");
      }
      // let the per-session filesystem providers pick the new skill up
      const skills = ctx?.get("skills");
      if (skills && typeof skills.invalidateCache === "function") skills.invalidateCache();
      return { name, path: existsSync(targetDir) ? targetDir : targetFile };
    }
  },
  "/ext/api/skill/uninstall": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf) => {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || !SKILL_NAME_RE.test(name)) throw err("bad-request", "invalid skill name");
      const config = configOf();
      const root = config.skillRoot ? resolve(config.skillRoot) : layout.defaultSkillRoot;
      let removed = 0;
      for (const target of [join(root, name), join(root, name + ".md")]) {
        if (existsSync(target)) {
          rmSync(target, { recursive: true, force: true });
          removed += 1;
        }
      }
      if (removed === 0) throw err("not-found", `no installed skill named \"${name}\"`);
      return { name, removed };
    }
  },
  "/ext/api/plugin/install": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf, ctx) => {
      const source = body.source;
      if (!source || typeof source !== "object" || typeof source.kind !== "string") throw err("bad-request", "source.kind is required");
      const state = loadState(layout);
      const stagingDir = join(layout.profileDir, ".dsh-ext-center-staging");
      rmSync(stagingDir, { recursive: true, force: true });
      let manifest;
      let target;
      let pkgName;
      try {
        manifest = await materializePackage(source, stagingDir);
        pkgName = manifest.name;
        if (pkgName === NAME) throw err("already-installed", "dsh-extension-center is built in");
        target = packageDirFor(layout.pluginRoot, pkgName);
        if (existsSync(target) && !(pkgName in state)) throw err("already-exists", `${target} already exists on disk — remove it first or uninstall the tracked package`);
        mkdirSync(dirname(target), { recursive: true });
        rmSync(target, { recursive: true, force: true });
        // move the staged package into place BEFORE the finally cleans staging
        cpSync(stagingDir, target, { recursive: true });
      } finally {
        rmSync(stagingDir, { recursive: true, force: true });
      }

      // Bundle patch rows (if the package declares dsh.bundle); a package
      // without one still needs a loader row or it would never activate.
      const bundleRows = bundlePatchRows(target);
      const rows = bundleRows.length > 0 ? bundleRows : [{ insert: [{ id: pkgName, name: pkgName }] }];
      const list = loadPatchList(layout);
      const raw = readFileSync(layout.patchFile, "utf8");

      // Reinstall: drop the previous tracked rows first so the merge can
      // re-add them (the loader row must round-trip through the patch file).
      if (pkgName in state) {
        const previous = state[pkgName];
        for (const prevRow of Array.isArray(previous.rows) ? previous.rows : []) {
          let at = list.findIndex((existing) => deepEqualJson(existing, prevRow));
          if (at === -1) at = list.findIndex((existing) => entrySignature(existing) === entrySignature(prevRow));
          if (at !== -1) list.splice(at, 1);
        }
      }

      // Ids already present anywhere in the composition must not be duplicated.
      const existingIds = new Set();
      for (const entry of list) {
        if (entry && typeof entry === "object" && entry.id) existingIds.add(String(entry.id));
        if (entry && Array.isArray(entry.insert)) for (const row of entry.insert) {
          if (row && typeof row === "object" && row.id) existingIds.add(String(row.id));
        }
      }
      try {
        const loader = ctx.get("loader");
        if (loader && typeof loader.entries === "function") for (const entry of loader.entries()) existingIds.add(String(entry.id));
      } catch { /* loader inspection is best-effort */ }
      const addedRows = mergePatchEntries(list, rows, existingIds);
      const record = {
        version: manifest.version ?? "",
        source,
        rows: addedRows,
        builtin: false,
        installedAt: new Date().toISOString()
      };
      if (pkgName in state) {
        const previous = state[pkgName];
        record.source = previous.source;
        record.builtin = previous.builtin === true;
      }
      state[pkgName] = record;
      // persist dependencies (informational; resolution uses the shared module root)
      const manifestFile = profileManifest(layout);
      manifestFile.dependencies ??= {};
      manifestFile.dependencies[pkgName] = `file:../node_modules/${pkgName}`;
      saveState(layout, state);
      saveProfileManifest(layout, manifestFile);
      await serializePatchWrite(layout, list, raw);
      const applied = await waitForLoaderState(ctx, (entries) => {
        for (const entry of entries) {
          if (entry.options?.name !== pkgName || entry.options?.id === "ext-center") continue;
          return !entry.disabled;
        }
        return false;
      });
      return {
        name: pkgName,
        version: record.version,
        rows: addedRows.length,
        restartNeeded: !applied,
        appliedLive: applied,
        note: applied
          ? "host rows activated live via the config watcher; a client bundle appears after a page refresh"
          : "the config watcher did not confirm the activation — restart dsh web once and the rows from cordis.patch.yml load normally"
      };
    }
  },
  "/ext/api/plugin/uninstall": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf, ctx) => {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw err("bad-request", "name is required");
      if (name === NAME) throw err("forbidden", "dsh-extension-center cannot be uninstalled from itself");
      const state = loadState(layout);
      const record = state[name];
      if (!record) throw err("not-found", `${name} is not tracked by the extension center`);
      const list = loadPatchList(layout);
      const raw = readFileSync(layout.patchFile, "utf8");
      let removedRows = 0;
      for (const prevRow of Array.isArray(record.rows) ? record.rows : []) {
        let at = list.findIndex((existing) => deepEqualJson(existing, prevRow));
        if (at === -1) at = list.findIndex((existing) => entrySignature(existing) === entrySignature(prevRow));
        if (at !== -1) {
          list.splice(at, 1);
          removedRows += 1;
        }
      }
      delete state[name];
      const target = packageDirFor(layout.pluginRoot, name);
      rmSync(target, { recursive: true, force: true });
      const manifest = profileManifest(layout);
      if (manifest.dependencies) delete manifest.dependencies[name];
      saveState(layout, state);
      saveProfileManifest(layout, manifest);
      await serializePatchWrite(layout, list, raw);
      const applied = await waitForLoaderState(ctx, (entries) => {
        for (const entry of entries) if (entry.options?.name === name) return false;
        return true;
      });
      return { name, removedRows, appliedLive: applied, restartNeeded: !applied };
    }
  },
  "/ext/api/plugin/set-enabled": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, layout, configOf, ctx) => {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw err("bad-request", "name is required");
      if (name === NAME) throw err("forbidden", "dsh-extension-center cannot be disabled");
      const enabled = body.enabled !== false;
      const state = loadState(layout);
      const record = state[name];
      if (!record) throw err("not-found", `${name} is not tracked by the extension center`);
      const list = loadPatchList(layout);
      const raw = readFileSync(layout.patchFile, "utf8");
      const { changed, updatedRows } = applyPluginDisabled(list, Array.isArray(record.rows) ? record.rows : [], !enabled);
      if (!changed) throw err("no-op", `${name} is already ${enabled ? "enabled" : "disabled"}`);
      record.disabled = !enabled;
      record.rows = updatedRows;
      saveState(layout, state);
      await serializePatchWrite(layout, list, raw);
      const applied = await waitForLoaderState(ctx, (entries) => {
        for (const entry of entries) {
          if (entry.options?.name === name && !entry.options?.id?.startsWith("ext-center")) {
            return entry.disabled === !enabled;
          }
        }
        return false;
      });
      return { name, enabled, appliedLive: applied, restartNeeded: !applied };
    }
  }
};

export { NAME, SETTINGS_NS, apply, inject };
