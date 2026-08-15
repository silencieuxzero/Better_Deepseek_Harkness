/**
 * better-deepseek-harness — host half.
 *
 * Provides the Better DeepSeek Harness for the DeepSeek Harness Web UI:
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
 * Deployment-tunable behavior (tree/terminal/git/mcp/vision ceilings, client
 * polling intervals, tool-argument repair) is validated ConfigSchema from the
 * plugin row's `config:` block in cordis.patch.yml — see resolveConfig and
 * README "部署配置". Security invariants (request/body/tree-file/terminal
 * write/git path ceilings) stay fixed constants.
 *
 * @module better-deepseek-harness
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
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { gunzipSync } from "node:zlib";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import yaml from "js-yaml";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { repairToolArguments } from "./tool-args.js";

/* ─────────────────────────── terminals ─────────────────────────── */

/**
 * Resolve node-pty when the deployment provides it (the harness's shared
 * module root ships it); otherwise terminals fall back to plain piped
 * spawns, which cover simple interactive use.
 */
let nodePty = null;
try {
  nodePty = createRequire(import.meta.url)("node-pty");
} catch { /* pty unavailable — fall back to plain pipes */ }

const TERMINAL_SHELLS = Object.freeze({
  cmd: { file: "cmd.exe", args: [] },
  powershell: { file: "powershell.exe", args: [] }
});

/** One terminal session: a pty (or pipe) wrapper plus an output ring buffer. */
const terminalSessions = new Map();

function terminalShellFor(kind) {
  const shell = TERMINAL_SHELLS[kind];
  if (!shell) throw err("bad-request", 'kind must be "cmd" or "powershell"');
  return shell;
}

/** Spawn the backing process and wire data/exit into the session. */
function spawnTerminalImpl(session, shell, cwd, bufferLimit) {
  const spawnImpl = nodePty
    ? (() => {
        const pty = nodePty.spawn(shell.file, shell.args, {
          name: "xterm-256color",
          cols: 100,
          rows: 30,
          cwd,
          env: process.env,
          useConpty: true
        });
        return {
          write: (data) => { try { pty.write(data); } catch { /* pty already gone */ } },
          resize: (cols, rows) => { try { pty.resize(cols, rows); } catch { /* ignore */ } },
          kill: () => pty.kill(),
          onData: (cb) => pty.onData(cb),
          onExit: (cb) => pty.onExit((e) => cb({ exitCode: e.exitCode }))
        };
      })()
    : (() => {
        const child = spawn(shell.file, shell.args, {
          cwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        });
        return {
          write: (data) => { try { child.stdin.write(data); } catch { /* ignore */ } },
          resize: () => { /* pipes cannot be resized */ },
          kill: () => { try { child.kill(); } catch { /* ignore */ } },
          onData: (cb) => child.stdout.on("data", (chunk) => cb(chunk.toString("utf8"))),
          onExit: (cb) => child.on("exit", (code) => cb({ exitCode: code }))
        };
      })();
  session.impl = spawnImpl;
  spawnImpl.onData((data) => {
    session.buffer = (session.buffer + data).slice(-bufferLimit);
  });
  spawnImpl.onExit((e) => {
    session.dead = true;
    session.exitCode = e.exitCode ?? null;
  });
}

/** Create a terminal session (bounded by cfg.terminal.maxSessions, injected spawner for tests). */
function createTerminalSession(kind, cwd, cfg, spawner = spawnTerminalImpl) {
  if (terminalSessions.size >= cfg.terminal.maxSessions) {
    throw err("term-cap", "too many terminals — close one first");
  }
  const shell = terminalShellFor(kind);
  const session = {
    id: randomUUID(),
    kind,
    cwd,
    createdAt: Date.now(),
    buffer: "",
    dead: false,
    exitCode: null,
    impl: null
  };
  try {
    spawner(session, shell, cwd, cfg.terminal.bufferLimit);
  } catch (error) {
    throw err("term-spawn", "cannot start " + shell.file + ": " + error.message);
  }
  terminalSessions.set(session.id, session);
  return session;
}

function terminalOutput(session, after) {
  const from = Number.isFinite(after) && after > 0 ? Math.min(after, session.buffer.length) : 0;
  return {
    id: session.id,
    alive: !session.dead,
    exitCode: session.dead ? session.exitCode : null,
    text: session.buffer.slice(from)
  };
}

/* ─────────────────────────── constants ─────────────────────────── */

/** The plugin's own version, read from its package.json (single source of truth). */
let PLUGIN_VERSION = "0.0.0";
try {
  PLUGIN_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version ?? PLUGIN_VERSION;
} catch { /* keep the fallback */ }

const NAME = "better-deepseek-harness";
const SETTINGS_NS = "ext-center";
const STATE_VERSION = 1;
const STATE_FILE = ".dsh-ext-center.json";
const PATCH_FILE = "cordis.patch.yml";
/** HTTP request-body ceiling (security invariant — hostile payloads are rejected). */
const BODY_LIMIT = 2 * 1024 * 1024; // 2 MiB
/** Editor ceiling for one tree file read or write (security invariant — the modal only shows round-trippable text). */
const MAX_TREE_FILE_SIZE = 1024 * 1024;
/** Single write payload cap for terminal input (security invariant). */
const TERMINAL_WRITE_LIMIT = 4096;
/** Ceiling on one batch of git paths from the client (security invariant). */
const GIT_PATHS_MAX = 500;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PKG_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
/** Skill-provider rank; keep aligned with dsh-skill-filesystem's custom directory rank. */
const CUSTOM_SKILL_RANK = 300;
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const DEFAULTS = Object.freeze({
  allowLan: false,
  skillRoot: "",
  customSkillDirs: [],
  treeRoot: "",
  vision: Object.freeze({
    enabled: false,
    provider: "",
    model: "",
    prompt: "",
    apiUrl: "",
    maxImages: 4
  })
});

/* ─────────────────────────── plugin config ─────────────────────────── */

/**
 * Deployment-tunable plugin config: the `config:` block of the `ext-center`
 * row in cordis.patch.yml. Every field owns both its default and its accepted
 * range here, and an invalid value fails the plugin load (misconfiguration
 * fails loud) instead of silently drifting.
 *
 * The security invariants above stay fixed: request-body, tree-file,
 * terminal-write, and git-path ceilings are not configurable. Protocol and
 * external-spec constants (skill rank, name regexes, git object ids) also stay
 * fixed.
 */
const ConfigSchema = z.object({
  /** Shared module root the extension center installs plugins into ("" = the profile's shared module root). */
  pluginRoot: z.string().default(""),
  tree: z.object({
    /** Ceiling on entries returned for one tree directory. */
    maxEntries: z.number().min(1).max(100000).default(2000),
    /** Entry names hidden by the file tree browser. */
    ignores: z.array(z.string().min(1)).default([
      ".git", ".svn", ".hg", "node_modules", ".dsh", "dist", ".next",
      ".cache", ".turbo", "coverage", "__pycache__", ".DS_Store"
    ])
  }).default({}),
  terminal: z.object({
    /** Concurrent terminal session ceiling. */
    maxSessions: z.number().min(1).max(64).default(8),
    /** Output ring buffer per terminal, in bytes (oldest output drops first). */
    bufferLimit: z.number().min(16 * 1024).max(16 * 1024 * 1024).default(256 * 1024)
  }).default({}),
  git: z.object({
    /** Ceiling on one git command run. */
    timeoutMs: z.number().min(1000).max(600000).default(60000),
    /** Ceiling on one diff payload before its line list is truncated. */
    diffLimit: z.number().min(16 * 1024).max(16 * 1024 * 1024).default(512 * 1024),
    /** Ceiling on the commit history list. */
    logMax: z.number().min(1).max(1000).default(30)
  }).default({}),
  mcp: z.object({
    /** Ceiling on panel-managed MCP servers. */
    maxServers: z.number().min(1).max(64).default(16)
  }).default({}),
  vision: z.object({
    /** Deployment ceiling on transcribed images per request. */
    maxImagesCap: z.number().min(1).max(32).default(8),
    /** Output cap for one transcription call, in tokens. */
    maxTokens: z.number().min(64).max(8192).default(1024)
  }).default({}),
  toolRepair: z.object({
    /** Whether the tools/execute wrapper repairs model tool arguments. */
    enabled: z.boolean().default(true),
    /** Neutral fill for a missing / empty / wrongly-typed `description` argument. */
    descriptionFill: z.string().min(1).max(200).default("Execute tool")
  }).default({}),
  client: z.object({
    /** Terminal output polling interval for the Web UI, in ms. */
    terminalPollMs: z.number().min(250).max(60000).default(300),
    /** Terminal list polling interval for the Web UI, in ms. */
    terminalListPollMs: z.number().min(250).max(60000).default(2000),
    /** Git status polling interval for the Web UI, in ms. */
    gitPollMs: z.number().min(250).max(60000).default(5000),
    /** MCP list polling interval for the Web UI, in ms. */
    mcpPollMs: z.number().min(250).max(60000).default(3000)
  }).default({})
});

/**
 * Validate the plugin config and resolve defaults into the `cfg` object the
 * rest of the plugin reads. Throws on invalid values so a broken
 * cordis.patch.yml config row fails the load with a clear message.
 * @param config - the raw `config` block from the ext-center loader row.
 * @returns the validated config; `cfg.tree.ignoreSet` is a pre-built Set
 *   mirroring `cfg.tree.ignores` for O(1) lookups.
 */
function resolveConfig(config) {
  let resolved;
  try {
    resolved = ConfigSchema(config && typeof config === "object" ? config : {});
  } catch (error) {
    throw new Error(`[${NAME}] invalid config on the ext-center row in cordis.patch.yml: ${error.message}`);
  }
  resolved.tree.ignoreSet = new Set(resolved.tree.ignores);
  return resolved;
}

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
  treeRoot: z.string().default(DEFAULTS.treeRoot),
  vision: z.object({
    enabled: z.boolean().default(false),
    provider: z.string().default(""),
    model: z.string().default(""),
    prompt: z.string().default(""),
    apiUrl: z.string().default(DEFAULTS.vision.apiUrl),
    maxImages: z.number().default(DEFAULTS.vision.maxImages)
  }).default({ ...DEFAULTS.vision })
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

function resolveLayout(ctx, cfg) {
  const baseUrl = ctx.baseUrl;
  if (typeof baseUrl !== "string") throw err("layout", "ctx.baseUrl is not set — cannot resolve the profile directory");
  const profileDir = fileURLToPath(new URL(".", baseUrl));
  const dshHome = resolveDshHome();
  const profilesDir = dirname(profileDir);
  const pluginRoot = cfg.pluginRoot
    ? resolve(String(cfg.pluginRoot))
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

function readConfig(ctx) {
  let settings;
  try {
    settings = ctx.get("settings");
  } catch { /* the settings service is optional in this deployment */ }
  const stored = settings && typeof settings.get === "function" ? settings.get(SETTINGS_NS) : void 0;
  return { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
}

/** The skill install root: the `skillRoot` setting, or the default user skill directory. */
function resolveSkillRoot(layout, config) {
  return config.skillRoot ? resolve(String(config.skillRoot)) : layout.defaultSkillRoot;
}

function skillRootsOf(layout, config) {
  const roots = [];
  const add = (root, source) => {
    const abs = resolve(root);
    if (!roots.some((r) => r.path === abs)) roots.push({ path: abs, source });
  };
  add(resolveSkillRoot(layout, config), config.skillRoot ? "custom" : "user-dsh");
  add(join(layout.agentsHome, "skills"), "user-agents");
  for (const dir of config.customSkillDirs) add(dir, "custom");
  return roots;
}

/* ─────────────────────────── patch file ─────────────────────────── */

function readPatchRaw(layout) {
  try {
    return readFileSync(layout.patchFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw err("patch-read", `cannot read ${layout.patchFile}: ${error.message}`);
  }
}

function loadPatchList(layout) {
  const raw = readPatchRaw(layout);
  if (raw.trim() === "") return [];
  let parsed;
  try {
    parsed = yaml.load(raw, { schema: patchSchema });
  } catch (error) {
    throw err("patch-invalid", `${layout.patchFile} is not valid YAML: ${error.message}`);
  }
  if (parsed === void 0 || parsed === null) return [];
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

/**
 * Poll the live loader until the predicate holds (or the timeout elapses).
 * The 8 s window matches the config watcher's worst-case reapply latency.
 */
async function waitForLoaderState(ctx, predicate, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let loader;
    try {
      loader = ctx.get("loader");
    } catch { /* loader inspection is best-effort */ }
    if (loader && typeof loader.entries === "function" && predicate(loader.entries())) return true;
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
      const freshRows = row.insert.filter((entry) => !(entry && typeof entry === "object" && entry.id && existingIds.has(String(entry.id))));
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
      } catch { /* frontmatter that fails to parse — the file is not a valid skill */
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
    } catch { /* absent root — no skills */
      continue;
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
  const gzipByHeader = /\bgzip\b/i.test(res.headers.get("content-encoding") ?? "");
  const gzipByMagic = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return gzipByHeader || gzipByMagic ? gunzipSync(buf) : buf;
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
  let dist = json.dist;
  let resolvedVersion = json.version;
  // The bare package endpoint (no version) returns dist-tags + versions, not a
  // top-level dist; fall back to the latest version's manifest for the tarball.
  if ((!dist || typeof dist.tarball !== "string") && json["dist-tags"] && typeof json["dist-tags"].latest === "string") {
    const latest = json.versions && typeof json.versions === "object" ? json.versions[json["dist-tags"].latest] : void 0;
    if (latest && latest.dist && typeof latest.dist.tarball === "string") {
      dist = latest.dist;
      resolvedVersion = json["dist-tags"].latest;
    }
  }
  if (!dist || typeof dist.tarball !== "string") throw err("registry-failed", `no tarball available for ${name}`);
  return { name, version: resolvedVersion, tarball: dist.tarball };
}

async function materializePackage(source, stagingDir) {
  mkdirSync(stagingDir, { recursive: true });
  switch (source.kind) {
    case "folder": {
      const src = resolve(String(source.path ?? ""));
      if (!existsSync(src) || !statSync(src).isDirectory()) throw err("source-not-found", `folder not found: ${source.path}`);
      // cpSync copies a source directory *into* an existing destination, so
      // remove the empty staging dir first: cpSync then recreates it with the
      // package's files at its root (package.json must sit at stagingDir/package.json).
      rmSync(stagingDir, { recursive: true, force: true });
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
  } catch { /* unreadable manifest — the package contributes no bundle patch rows */
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

function registerSkillProvider(ctx, configOf) {
  return ctx.effect(() => {
    let skills;
    try {
      skills = ctx.get("skills");
    } catch { /* the skills service is optional in this deployment */ }
    if (!skills || typeof skills.registerProvider !== "function") {
      ctx.logger?.warn?.("better-deepseek-harness: skills service is not mounted — custom skill directories stay unprovided");
      return;
    }
    const provider = buildCustomSkillProvider(configOf);
    const dispose = skills.registerProvider(() => provider);
    ctx.logger?.info?.("better-deepseek-harness: skill provider registered for custom directories");
    return () => { if (typeof dispose === "function") dispose(); };
  }, "better-deepseek-harness: skill provider");
}

function buildCustomSkillProvider(configOf) {
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
        } catch { /* unreadable directory — it contributes no skills */
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
  return provider;
}

/* ─────────────────────────── plugin lifecycle ─────────────────────────── */

function profileManifest(layout) {
  try {
    return JSON.parse(readFileSync(layout.manifestFile, "utf8"));
  } catch { /* absent or malformed profile manifest — synthesize an empty one */
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

/* ─────────────────────────── git ─────────────────────────── */

/** The git empty-tree object id — the diff base when HEAD does not exist yet. */
const GIT_EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
/** Control bytes that must never appear in a client-supplied git path. */
const GIT_PATH_BAD = /[\0\r\n]/;

/**
 * Run a git command and resolve with its stdout. Prompts never hang the
 * request: GIT_TERMINAL_PROMPT=0 fails credential prompts fast, and the
 * timeout (cfg.git.timeoutMs) kills runaway commands.
 * @param repoDir - repository working directory.
 * @param args - git arguments (the first is the subcommand).
 * @param timeoutMs - ceiling on the command run in milliseconds.
 * @returns the captured stdout.
 */
function runGit(repoDir, args, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["-c", "core.quotepath=false", "-c", "color.ui=false", ...args], {
      cwd: repoDir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const chunks = [];
    const errorChunks = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch { /* already gone */ }
    }, timeoutMs);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errorChunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(err("git-spawn", "cannot run git: " + error.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const message = Buffer.concat(errorChunks).toString("utf8").trim();
        reject(err(timedOut ? "git-timeout" : "git-failed", message || "git exited with code " + code));
        return;
      }
      resolvePromise(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

/**
 * Find the repository containing the file tree root by walking ancestors
 * looking for a .git entry (directory, worktree pointer, or submodule
 * gitfile). Returns null when the tree root lives outside any repository.
 */
function discoverGitRoot(cx, sessionId) {
  const { ctx, layout, configOf } = cx;
  let probe;
  try {
    probe = resolveTreeRoot(ctx, layout, configOf, sessionId);
  } catch { /* unreadable tree root — fall back to the process cwd */
    probe = process.cwd();
  }
  for (;;) {
    if (existsSync(join(probe, ".git"))) return probe;
    const parent = dirname(probe);
    if (parent === probe) return null;
    probe = parent;
  }
}

/** Like discoverGitRoot, but throws the API error shape the client expects. */
function requireGitRoot(cx, sessionId) {
  const root = discoverGitRoot(cx, sessionId);
  if (!root) throw err("git-no-repo", "the current tree root is not inside a git repository");
  return root;
}

/** The session whose workspace a git request should address (body wins over query). */
function gitSessionId(body, query) {
  const fromBody = body && typeof body.sessionId === "string" && body.sessionId.trim() !== "" ? body.sessionId.trim() : "";
  if (fromBody) return fromBody;
  const fromQuery = query && typeof query.get === "function" ? query.get("sessionId") : "";
  return typeof fromQuery === "string" && fromQuery.trim() !== "" ? fromQuery.trim() : void 0;
}

/**
 * Validate one client-supplied repository-relative path: no option
 * injection, no absolute paths, no traversal outside the repository, and no
 * control bytes.
 */
function checkGitPath(value, root) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    throw err("bad-request", "invalid git path");
  }
  if (value.startsWith("-") || isAbsolute(value) || GIT_PATH_BAD.test(value)) {
    throw err("bad-request", "invalid git path: " + value);
  }
  const abs = resolve(root, value);
  if (abs !== root && !abs.startsWith(root + sep)) throw err("bad-request", "git path outside the repository: " + value);
  return value;
}

/** Validate a batch of client-supplied paths (shared by stage/unstage/discard). */
function checkGitPaths(body, root) {
  const paths = Array.isArray(body.paths) ? body.paths : [];
  if (paths.length === 0 || paths.length > GIT_PATHS_MAX) {
    throw err("bad-request", "paths must be a non-empty array of at most " + GIT_PATHS_MAX + " entries");
  }
  return paths.map((path) => checkGitPath(path, root));
}

/**
 * Parse `git status --porcelain=v2 -z -b --untracked-files=all` output.
 * Records are NUL-terminated; rename/copy records carry the original path in
 * an extra NUL segment right after the record.
 */
function parseGitStatus(raw) {
  const state = {
    branch: null,
    oid: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    detached: false,
    changes: []
  };
  const segments = raw.split("\0");
  for (let i = 0; i < segments.length; i += 1) {
    const record = segments[i];
    if (!record) continue;
    if (record.startsWith("#")) {
      if (record.startsWith("# branch.head ")) {
        const head = record.slice("# branch.head ".length).trim();
        state.detached = head === "(detached)";
        if (!state.detached) state.branch = head;
      } else if (record.startsWith("# branch.oid ")) {
        state.oid = record.slice("# branch.oid ".length).trim();
      } else if (record.startsWith("# branch.upstream ")) {
        state.upstream = record.slice("# branch.upstream ".length).trim();
      } else if (record.startsWith("# branch.ab ")) {
        const match = /\+(\d+) -(\d+)/.exec(record);
        state.ahead = match ? Number(match[1]) : 0;
        state.behind = match ? Number(match[2]) : 0;
      }
      continue;
    }
    if (record.startsWith("!")) continue; // ignored entries are not shown
    if (record.startsWith("?")) {
      state.changes.push({ path: record.slice(2), x: "?", y: "?", untracked: true });
      continue;
    }
    // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> [<h3>] <path> — git 2.54 prints a
    // third oid (stage 3); skip modes (6 digits) and oids (40 hex) by shape so
    // both variants parse, then everything left is the path (spaces allowed).
    if (record.startsWith("u ")) {
      const fields = record.split(" ");
      let at = 3;
      while (at < fields.length && /^(\d{6}|[0-9a-f]{40})$/.test(fields[at])) at += 1;
      state.changes.push({ path: fields.slice(at).join(" "), x: fields[1][0], y: fields[1][1], unmerged: true });
      continue;
    }
    // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
    if (record.startsWith("1 ")) {
      const fields = record.split(" ");
      state.changes.push({ path: fields.slice(8).join(" "), x: fields[1][0], y: fields[1][1] });
      continue;
    }
    // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> [<X><score>] <path> — renames and
    // copies keep <X><score> and append the original path in the next NUL segment.
    if (record.startsWith("2 ")) {
      const fields = record.split(" ");
      const x = fields[1][0];
      const y = fields[1][1];
      const renamed = x === "R";
      const copied = x === "C";
      const path = (renamed || copied ? fields.slice(9) : fields.slice(8)).join(" ");
      const change = { path, x, y, renamed, copied };
      if (renamed || copied) {
        change.orig = segments[i + 1] ?? "";
        i += 1;
      }
      state.changes.push(change);
    }
  }
  for (const change of state.changes) {
    change.staged = change.x !== "." && change.x !== " " && change.x !== "?";
    change.unstaged = change.y !== "." && change.y !== " " && change.y !== "?" && !/^\d+$/.test(change.y);
  }
  return state;
}

/** Fetch and parse the repository status (shared by /status and the diff resolver). */
async function gitStatusOf(cx, sessionId) {
  const root = requireGitRoot(cx, sessionId);
  const raw = await runGit(root, ["status", "--porcelain=v2", "-z", "-b", "--untracked-files=all"], cx.cfg.git.timeoutMs);
  const state = parseGitStatus(raw);
  return { root, state };
}

const GIT_DIFF_META_RE = /^(diff --|index |old mode|new mode|new file mode|deleted file mode|similarity index|rename from|rename to|copy from|copy to|Binary files|--- |\+\+\+ )/;

/** Split diff text into lines, dropping the artificial trailing empty line. */
function splitDiffLines(text) {
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Parse a @@ hunk header into the two side counters. */
function parseHunkHeader(line) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === void 0 ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === void 0 ? 1 : Number(match[4])
  };
}

/**
 * Parse unified diff text into structured lines with per-side line numbers.
 * Combined diffs (merge conflicts, `diff --cc`) are returned raw — their
 * multi-column markers do not map onto single-side numbering.
 */
function parseUnifiedDiff(text, limit) {
  const out = { binary: false, truncated: false, combined: false, lines: [] };
  let size = 0;
  let oldNo = null;
  let newNo = null;
  for (const line of splitDiffLines(text)) {
    size += line.length + 1;
    if (size > limit) {
      out.truncated = true;
      break;
    }
    if (line.startsWith("diff --cc")) out.combined = true;
    if (line.startsWith("Binary files ")) out.binary = true;
    if (out.combined) {
      out.lines.push({ kind: "raw", text: line });
      continue;
    }
    if (GIT_DIFF_META_RE.test(line)) {
      out.lines.push({ kind: "meta", text: line });
      continue;
    }
    if (line.startsWith("@@")) {
      const hunk = parseHunkHeader(line);
      oldNo = hunk ? hunk.oldStart : null;
      newNo = hunk ? hunk.newStart : null;
      out.lines.push({ kind: "hunk", text: line });
      continue;
    }
    if (line.startsWith("+")) {
      out.lines.push({ kind: "add", text: line.slice(1), newNo });
      if (newNo !== null) newNo += 1;
      continue;
    }
    if (line.startsWith("-")) {
      out.lines.push({ kind: "del", text: line.slice(1), oldNo });
      if (oldNo !== null) oldNo += 1;
      continue;
    }
    if (line.startsWith("\\")) {
      out.lines.push({ kind: "meta", text: line });
      continue;
    }
    out.lines.push({ kind: "ctx", text: line.startsWith(" ") ? line.slice(1) : line, oldNo, newNo });
    if (oldNo !== null) oldNo += 1;
    if (newNo !== null) newNo += 1;
  }
  return out;
}

/** Synthesize an all-added diff for an untracked file straight from disk. */
function readUntrackedDiff(root, path, limit) {
  const abs = resolve(root, path);
  let stat;
  try {
    stat = statSync(abs);
  } catch (error) {
    throw err("git-read", "cannot read " + path + ": " + error.message);
  }
  if (!stat.isFile()) throw err("git-not-file", path + " is not a file");
  if (stat.size > limit) {
    throw err("git-too-large", "file is " + stat.size + " bytes — the diff limit is " + limit + " bytes");
  }
  const raw = readFileSync(abs);
  if (raw.includes(0)) return { binary: true, truncated: false, combined: false, lines: [] };
  const fileLines = splitDiffLines(raw.toString("utf8"));
  const lines = [
    { kind: "meta", text: "diff --git a/" + path + " b/" + path },
    { kind: "meta", text: "new file mode 100644" },
    { kind: "hunk", text: "@@ -0,0 +1," + fileLines.length + " @@" }
  ];
  let no = 1;
  for (const line of fileLines) {
    lines.push({ kind: "add", text: line, newNo: no });
    no += 1;
  }
  return { binary: false, truncated: false, combined: false, lines };
}

/** Whether the repository has any commit (false on a fresh unborn branch). */
async function hasGitHead(root, timeoutMs) {
  try {
    await runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD"], timeoutMs);
    return true;
  } catch { /* no HEAD or git failed — treat as an unborn branch */
    return false;
  }
}

function gitStatus(body, cx, query) {
  return gitStatusOf(cx, gitSessionId(body, query)).then(({ root, state }) => ({ root, ...state }));
}

async function gitDiff(body, cx, query) {
  const sessionId = gitSessionId(body, query);
  const { root, state } = await gitStatusOf(cx, sessionId);
  const get = query && typeof query.get === "function" ? query.get.bind(query) : () => null;
  const path = checkGitPath(String(get("path") || ""), root);
  const staged = get("staged") === "1";
  const change = state.changes.find((entry) => entry.path === path);
  if (change && change.untracked) {
    return { root, path, staged: false, untracked: true, ...readUntrackedDiff(root, path, cx.cfg.git.diffLimit) };
  }
  const args = ["diff", "--no-color", "--unified=3"];
  if (staged) {
    args.push("--cached");
    if (!(await hasGitHead(root, cx.cfg.git.timeoutMs))) args.push(GIT_EMPTY_TREE);
  }
  args.push("--", path);
  const text = await runGit(root, args, cx.cfg.git.timeoutMs);
  return { root, path, staged, untracked: false, ...parseUnifiedDiff(text, cx.cfg.git.diffLimit) };
}

function gitStage(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  const paths = checkGitPaths(body, root);
  return runGit(root, ["add", "--", ...paths], cx.cfg.git.timeoutMs).then(() => ({ staged: paths }));
}

function gitUnstage(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  const paths = checkGitPaths(body, root);
  return runGit(root, ["restore", "--staged", "--", ...paths], cx.cfg.git.timeoutMs).then(() => ({ unstaged: paths }));
}

/** Discard worktree edits (git checkout) and delete untracked files (only when still untracked). */
async function gitDiscard(body, cx) {
  const sessionId = gitSessionId(body, void 0);
  const { root, state } = await gitStatusOf(cx, sessionId);
  const paths = checkGitPaths(body, root);
  const untracked = new Set(state.changes.filter((entry) => entry.untracked).map((entry) => entry.path));
  const checkout = [];
  let deletedUntracked = 0;
  for (const path of paths) {
    if (untracked.has(path)) {
      const abs = resolve(root, path);
      let stat;
      try {
        stat = statSync(abs);
      } catch { /* already gone — nothing to delete */
        continue;
      }
      if (stat.isDirectory()) throw err("git-discard-dir", "refusing to delete a directory: " + path);
      rmSync(abs, { force: true });
      deletedUntracked += 1;
    } else {
      checkout.push(path);
    }
  }
  if (checkout.length > 0) await runGit(root, ["checkout", "--", ...checkout], cx.cfg.git.timeoutMs);
  return { discarded: paths, deletedUntracked };
}

function gitCommit(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw err("bad-request", "commit message is empty");
  if (message.length > 4096 || message.includes("\0")) throw err("bad-request", "invalid commit message");
  return runGit(root, ["commit", "-m", message], cx.cfg.git.timeoutMs).then((out) => {
    const match = /\[[^\]]*\s([0-9a-f]{7,40})\s*\]/.exec(String(out).split("\n")[0] ?? "");
    return { oid: match ? match[1] : null };
  });
}

async function gitBranches(body, cx, query) {
  const root = requireGitRoot(cx, gitSessionId(body, query));
  const raw = await runGit(root, ["branch", "--no-color", "--list"], cx.cfg.git.timeoutMs);
  const branches = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    branches.push({ name: line.replace(/^[* ] /, "").trim(), current: line.startsWith("*") });
  }
  return { branches };
}

const GIT_BRANCH_RE = /^[A-Za-z0-9._@+/~#-]{1,200}$/;

function gitCheckout(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  const branch = typeof body.branch === "string" ? body.branch : "";
  if (!GIT_BRANCH_RE.test(branch)) throw err("bad-request", "invalid branch name");
  return runGit(root, ["checkout", branch], cx.cfg.git.timeoutMs).then(() => ({ branch }));
}

function gitPull(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  return runGit(root, ["pull", "--ff-only"], cx.cfg.git.timeoutMs).then((out) => ({ summary: out.trim().split("\n").filter(Boolean).slice(-3) }));
}

function gitPush(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  return runGit(root, ["push"], cx.cfg.git.timeoutMs).then((out) => ({ summary: out.trim().split("\n").filter(Boolean).slice(-3) }));
}

async function gitLog(body, cx, query) {
  const root = requireGitRoot(cx, gitSessionId(body, query));
  const get = query && typeof query.get === "function" ? query.get.bind(query) : () => null;
  const want = Number(get("n"));
  const n = Number.isFinite(want) && want > 0 ? Math.min(Math.floor(want), cx.cfg.git.logMax) : cx.cfg.git.logMax;
  const raw = await runGit(root, ["log", "-n", String(n), "--no-color", "--format=%H%x1f%h%x1f%an%x1f%at%x1f%s"], cx.cfg.git.timeoutMs);
  const commits = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split("\x1f");
    commits.push({
      oid: fields[0] ?? "",
      short: fields[1] ?? "",
      author: fields[2] ?? "",
      time: Number(fields[3]) || 0,
      subject: fields.slice(4).join("\x1f")
    });
  }
  return { commits };
}

/* ─────────────────────────── mcp servers ─────────────────────────── */

/** MCP server names follow the mcp-client serverName contract. */
const MCP_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
/** Loader-row id prefix this panel owns (external hand-written rows stay read-only). */
const MCP_ROW_ID_PREFIX = "ext-center.mcp.";
/** Env-var key shape for stdio servers. */
const MCP_ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** HTTP header-name shape for streamable-http servers. */
const MCP_HEADER_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
/** Streamable-http servers must use http(s). */
const MCP_URL_RE = /^https?:\/\/\S+$/i;

/** The loader-row id for one panel-managed MCP server. */
function mcpRowId(name) {
  return MCP_ROW_ID_PREFIX + name;
}

/** All MCP rows in a patch list (managed and external), newest last. */
function mcpRowsIn(list) {
  const found = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const entries = Array.isArray(row.insert) ? row.insert : [row];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.name !== "@deepseek-ai/dsh-mcp-client") continue;
      found.push({ row, entry });
    }
  }
  return found;
}

/**
 * Validate a string-map sub-config (env / headers): bounded entry count,
 * restricted key shape, NUL-free string values.
 */
function mcpStringMap(value, field, keyRe, maxEntries, maxValueLen) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw err("bad-request", field + " must be an object");
  }
  const out = {};
  const keys = Object.keys(value);
  if (keys.length > maxEntries) throw err("bad-request", field + " has too many entries (max " + maxEntries + ")");
  for (const key of keys) {
    if (!keyRe.test(key)) throw err("bad-request", "invalid " + field + " key: " + key);
    const item = value[key];
    if (typeof item !== "string" || item.length > maxValueLen || item.includes("\0")) {
      throw err("bad-request", "invalid " + field + " value for " + key);
    }
    out[key] = item;
  }
  return out;
}

/**
 * Validate one add request into the mcp-client row config shape. Startup
 * failures are surfaced (failOnStartupError) so a broken server reads as a
 * failed row in the list instead of silently activating without tools.
 */
function mcpConfigFrom(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!MCP_NAME_RE.test(name)) {
    throw err("bad-request", "server name must match [A-Za-z0-9_-]{1,32} (model tools become mcp__" + name + "__<tool>)");
  }
  const transport = body.transport;
  if (transport !== "stdio" && transport !== "streamable-http") {
    throw err("bad-request", 'transport must be "stdio" or "streamable-http"');
  }
  const config = { serverName: name, transport, failOnStartupError: true };
  if (transport === "stdio") {
    const command = typeof body.command === "string" ? body.command.trim() : "";
    if (!command || command.length > 1024 || command.includes("\0")) throw err("bad-request", "command is required");
    config.command = command;
    if (body.args !== void 0 && !(Array.isArray(body.args) && body.args.length === 0)) {
      if (!Array.isArray(body.args) || body.args.length > 64 || body.args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))) {
        throw err("bad-request", "args must be an array of strings (max 64)");
      }
      config.args = body.args;
    }
    if (body.env !== void 0) config.env = mcpStringMap(body.env, "env", MCP_ENV_KEY_RE, 64, 4096);
    if (body.cwd !== void 0 && String(body.cwd).trim() !== "") {
      const cwd = String(body.cwd).trim();
      if (cwd.length > 1024 || cwd.includes("\0")) throw err("bad-request", "invalid cwd");
      config.cwd = cwd;
    }
  } else {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!MCP_URL_RE.test(url) || url.length > 2048) throw err("bad-request", "a valid http(s) url is required");
    config.url = url;
    if (body.headers !== void 0) config.headers = mcpStringMap(body.headers, "headers", MCP_HEADER_RE, 64, 4096);
  }
  if (body.toolCallTimeoutMs !== void 0 && body.toolCallTimeoutMs !== null && String(body.toolCallTimeoutMs).trim() !== "") {
    const ms = Number(body.toolCallTimeoutMs);
    if (!Number.isFinite(ms) || ms < 1000 || ms > 600000) throw err("bad-request", "toolCallTimeoutMs must be between 1000 and 600000");
    config.toolCallTimeoutMs = Math.floor(ms);
  }
  return { name, config };
}

/** Live loader entry lookup for the panel's MCP rows. */
function mcpLoaderEntries(ctx) {
  const live = new Map();
  let loader;
  try {
    loader = ctx.get("loader");
  } catch { /* loader inspection is best-effort */ }
  if (loader && typeof loader.entries === "function") {
    for (const entry of loader.entries()) live.set(String(entry.id), entry);
  }
  return live;
}

/** The MCP list: one row per patch entry (managed + external) with live status. */
function mcpSnapshot(body, cx) {
  const { layout, ctx, cfg } = cx;
  const live = mcpLoaderEntries(ctx);
  const servers = mcpRowsIn(loadPatchList(layout)).map(({ entry }) => {
    const config = entry.config && typeof entry.config === "object" ? entry.config : {};
    const id = typeof entry.id === "string" ? entry.id : "";
    const liveEntry = live.get(id);
    return {
      name: typeof config.serverName === "string" ? config.serverName : id,
      id,
      managed: id.startsWith(MCP_ROW_ID_PREFIX),
      enabled: entry.disabled !== true,
      transport: typeof config.transport === "string" ? config.transport : null,
      command: typeof config.command === "string" ? config.command : null,
      args: Array.isArray(config.args) ? config.args : [],
      url: typeof config.url === "string" ? config.url : null,
      cwd: typeof config.cwd === "string" ? config.cwd : null,
      envKeys: config.env && typeof config.env === "object" ? Object.keys(config.env).sort() : [],
      headerKeys: config.headers && typeof config.headers === "object" ? Object.keys(config.headers).sort() : [],
      toolCallTimeoutMs: typeof config.toolCallTimeoutMs === "number" ? config.toolCallTimeoutMs : null,
      fiberPhase: liveEntry ? ["pending", "loading", "active", "failed", "disposed", "unloading"][liveEntry.fiber?.state] ?? "unobserved" : null
    };
  });
  return { servers, max: cfg.mcp.maxServers };
}

async function mcpAdd(body, cx) {
  const { layout, ctx, cfg } = cx;
  const { name, config } = mcpConfigFrom(body);
  const rowId = mcpRowId(name);
  const list = loadPatchList(layout);
  const raw = readPatchRaw(layout);
  const managed = mcpRowsIn(list).filter(({ entry }) => String(entry.id).startsWith(MCP_ROW_ID_PREFIX)).length;
  if (managed >= cfg.mcp.maxServers) throw err("mcp-cap", "too many MCP servers (max " + cfg.mcp.maxServers + ") — remove one first");
  const existingIds = new Set();
  for (const row of list) {
    if (row && typeof row === "object" && row.id) existingIds.add(String(row.id));
    if (row && Array.isArray(row.insert)) for (const entry of row.insert) {
      if (entry && typeof entry === "object" && entry.id) existingIds.add(String(entry.id));
    }
  }
  for (const [id] of mcpLoaderEntries(ctx)) existingIds.add(id);
  if (existingIds.has(rowId)) throw err("already-exists", "an MCP server named \"" + name + "\" already exists");
  mergePatchEntries(list, [{ insert: [{ id: rowId, name: "@deepseek-ai/dsh-mcp-client", config }] }], existingIds);
  await serializePatchWrite(layout, list, raw);
  const applied = await waitForLoaderState(ctx, (entries) => {
    for (const entry of entries) if (String(entry.id) === rowId) return !entry.disabled;
    return false;
  });
  return { name, rowId, appliedLive: applied, restartNeeded: !applied };
}

async function mcpRemove(body, cx) {
  const { layout, ctx } = cx;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!MCP_NAME_RE.test(name)) throw err("bad-request", "invalid server name");
  const rowId = mcpRowId(name);
  const list = loadPatchList(layout);
  const raw = readPatchRaw(layout);
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const row = list[i];
    if (!row || typeof row !== "object") continue;
    if (Array.isArray(row.insert)) {
      const before = row.insert.length;
      row.insert = row.insert.filter((entry) => !(entry && typeof entry === "object" && String(entry.id) === rowId));
      if (row.insert.length !== before) removed += 1;
      if (row.insert.length === 0) list.splice(i, 1);
    } else if (String(row.id) === rowId) {
      list.splice(i, 1);
      removed += 1;
    }
  }
  if (removed === 0) throw err("not-found", "no panel-managed MCP server named \"" + name + "\"");
  await serializePatchWrite(layout, list, raw);
  const applied = await waitForLoaderState(ctx, (entries) => {
    for (const entry of entries) if (String(entry.id) === rowId) return false;
    return true;
  });
  return { name, removed, appliedLive: applied, restartNeeded: !applied };
}

async function mcpSetEnabled(body, cx) {
  const { layout, ctx } = cx;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!MCP_NAME_RE.test(name)) throw err("bad-request", "invalid server name");
  const enabled = body.enabled !== false;
  const rowId = mcpRowId(name);
  const list = loadPatchList(layout);
  const raw = readPatchRaw(layout);
  let changed = false;
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const entries = Array.isArray(row.insert) ? row.insert : [row];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || String(entry.id) !== rowId) continue;
      if (!enabled && entry.disabled !== true) {
        entry.disabled = true;
        changed = true;
      } else if (enabled && entry.disabled === true) {
        delete entry.disabled;
        changed = true;
      }
    }
  }
  if (!changed) throw err("no-op", "MCP server \"" + name + "\" is already " + (enabled ? "enabled" : "disabled"));
  await serializePatchWrite(layout, list, raw);
  const applied = await waitForLoaderState(ctx, (entries) => {
    for (const entry of entries) if (String(entry.id) === rowId) return entry.disabled === !enabled;
    return false;
  });
  return { name, enabled, appliedLive: applied, restartNeeded: !applied };
}

/* ─────────────────────────── image transcription ─────────────────────────── */

/** Default instruction the vision model receives for one image. */
const VISION_DEFAULT_PROMPT = "请详细描述这张图片的全部内容，包括其中的文字、图表、界面元素与细节，供无法直接查看图片的模型使用。";
/** Normalize the user-configured vision profile (partial settings survive). */
function visionConfigOf(config, cfg) {
  const raw = config && typeof config.vision === "object" && config.vision !== null ? config.vision : {};
  const maxImages = Math.min(Math.max(Number(raw.maxImages) || DEFAULTS.vision.maxImages, 1), cfg.vision.maxImagesCap);
  return {
    enabled: raw.enabled === true,
    provider: typeof raw.provider === "string" ? raw.provider.trim() : "",
    model: typeof raw.model === "string" ? raw.model.trim() : "",
    prompt: typeof raw.prompt === "string" && raw.prompt.trim() !== "" ? raw.prompt.trim() : VISION_DEFAULT_PROMPT,
    apiUrl: typeof raw.apiUrl === "string" ? raw.apiUrl.trim() : "",
    maxImages
  };
}

/** True when typed content contains an image block, walking nested tool results. */
function contentHasImageBlocks(content) {
  return (content || []).some((block) => block.type === "image" || block.type === "tool-result" && contentHasImageBlocks(block.content));
}

/** Whether the request is the configured vision route itself (native image pass-through). */
function isVisionRoute(options, vision) {
  return options.provider === vision.provider && options.model === vision.model;
}

/** Whether one request needs image transcription under the configured profile. */
function needsTranscription(options, vision) {
  if (!vision.enabled || vision.model === "") return false;
  if (vision.provider === "custom") {
    if (vision.apiUrl === "") return false;
  } else if (vision.provider === "") {
    return false;
  }
  if (isVisionRoute(options, vision)) return false;
  return (options.messages || []).some((message) => contentHasImageBlocks(message.content));
}

/** Collect the visible text of one transcription stream. */
async function collectStreamText(stream) {
  let text = "";
  for await (const chunk of stream) {
    if (chunk.type === "text-delta") text += typeof chunk.text === "string" ? chunk.text : "";
    else if (chunk.type === "finish") break;
  }
  return text.trim();
}

/** Custom vision routes must be real http(s) endpoints (OpenAI-compatible). */
const CUSTOM_VISION_URL_RE = /^https?:\/\//i;

/** Normalize a user-entered API URL into an OpenAI-compatible chat/completions URL. */
function customVisionEndpoint(apiUrl) {
  const trimmed = apiUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return trimmed + "/chat/completions";
}

/** Read one image attachment back as a data URL for a custom vision endpoint. */
async function imageDataUrl(ctx, attachment, signal) {
  let attachments;
  try {
    attachments = ctx.get("attachments");
  } catch { /* the attachment service is optional in this deployment */ }
  if (!attachments || typeof attachments.readImage !== "function") {
    throw new Error("attachment service is unavailable");
  }
  const stored = await attachments.readImage(attachment, signal);
  const mediaType = stored?.ref?.mediaType || "image/png";
  return `data:${mediaType};base64,${Buffer.from(stored.data).toString("base64")}`;
}

/** One transcription call against a user-supplied OpenAI-compatible endpoint. */
async function customVisionText(ctx, vision, imageBlock, maxTokens, signal) {
  const endpoint = customVisionEndpoint(vision.apiUrl);
  if (!CUSTOM_VISION_URL_RE.test(endpoint)) {
    throw new Error("vision API URL must start with http:// or https://");
  }
  const dataUrl = await imageDataUrl(ctx, imageBlock.attachment, signal);
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: vision.model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: vision.prompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }],
        max_tokens: maxTokens,
        stream: false
      }),
      signal: signal ?? AbortSignal.timeout(120_000)
    });
  } catch (error) {
    throw new Error("custom vision request failed: " + (error?.message ?? String(error)));
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`custom vision endpoint returned HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("custom vision endpoint returned no text content");
  }
  return content.trim();
}

/** One transcription call: the vision prompt plus a single image block. */
function buildVisionRequest(vision, imageBlock, sessionId, signal, maxTokens) {
  return {
    provider: vision.provider,
    model: vision.model,
    messages: [{
      id: randomUUID(),
      role: "user",
      content: [
        { type: "text", text: vision.prompt },
        { type: "image", attachment: imageBlock.attachment }
      ]
    }],
    maxTokens,
    ...(sessionId !== void 0 ? { sessionId } : {}),
    ...(signal ? { signal } : {})
  };
}

/** Rewrite content recursively, replacing transcribed image blocks with text. */
function rewriteContent(content, replacements) {
  return content.map((block) => {
    if (block.type === "image") {
      const text = replacements.get(block);
      return text ? { type: "text", text } : block;
    }
    if (block.type === "tool-result") {
      return { ...block, content: rewriteContent(block.content, replacements) };
    }
    return block;
  });
}

/**
 * Transcribe every image in the request (bounded by vision.maxImages) through
 * the configured vision route, then return the rewritten request. Failures
 * degrade to placeholder text instead of breaking the turn.
 */
async function transcribeRequest(ctx, llm, options, vision, cfg) {
  const replacements = new Map();
  let seen = 0;
  for (const message of options.messages) {
    if (!contentHasImageBlocks(message.content)) continue;
    const images = [];
    const walk = (content) => {
      for (const block of content) {
        if (block.type === "image") images.push(block);
        else if (block.type === "tool-result") walk(block.content);
      }
    };
    walk(message.content);
    for (const image of images) {
      seen += 1;
      let text;
      if (seen > vision.maxImages) {
        text = "[图片转述：超出单次请求上限（" + vision.maxImages + " 张），此图片未转述]";
      } else {
        try {
          let described;
          if (vision.provider === "custom") {
            described = await customVisionText(ctx, vision, image, cfg.vision.maxTokens, options.signal);
          } else {
            const request = buildVisionRequest(vision, image, options.sessionId, options.signal, cfg.vision.maxTokens);
            const stream = await llm.stream(request);
            described = await collectStreamText(stream);
          }
          text = described === "" ? "[图片转述：视觉模型未返回内容]" : "[图片转述（" + (vision.provider === "custom" ? "自定义" : vision.provider) + " / " + vision.model + "）]：\n" + described;
        } catch (error) {
          text = "[图片转述失败（" + (vision.provider === "custom" ? "自定义" : vision.provider) + " / " + vision.model + "）：" + (error && error.message ? error.message : String(error)) + "]";
        }
      }
      replacements.set(image, text);
    }
  }
  return { ...options, messages: options.messages.map((message) => ({ ...message, content: rewriteContent(message.content, replacements) })) };
}

/**
 * Register the llm/stream waterfall listener: requests containing images are
 * transcribed through the configured vision model before the text-only
 * adapter sees them. Registered global so it also covers scoped llm instances.
 */
function registerVisionListener(ctx, configOf, cfg) {
  try {
    // The waterfall contract: every llm/stream listener returns the next
    // listener's value, and the outermost return value must be an async
    // iterable — dsh-agent-loop consumes it with for-await and sibling
    // middleware with yield* next(). An async callback that returns
    // llm.stream(...) yields a Promise and breaks every session
    // ("yield* ... is not async iterable"), so the transcribed path is an
    // async generator and the pass-through path forwards next() untouched.
    ctx.on("llm/stream", (options, next) => {
      let vision;
      try {
        vision = visionConfigOf(configOf(), cfg);
      } catch { /* unreadable settings — pass the request through untouched */ }
      if (!vision || !needsTranscription(options, vision)) return next();
      let llm;
      try {
        llm = ctx.get("llm");
      } catch { /* the llm service is optional in this deployment */ }
      if (!llm || typeof llm.stream !== "function") return next();
      return (async function* () {
        const rewritten = await transcribeRequest(ctx, llm, options, vision, cfg);
        yield* llm.stream(rewritten);
      })();
    }, { global: true });
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: llm/stream wrapper registration failed: %s", error?.message ?? error);
    return;
  }
  ctx.logger?.info?.("better-deepseek-harness: llm/stream image-transcription wrapper registered");
}

/* ─────────────────────────── the plugin ─────────────────────────── */

const inject = ["webServer", "tools"];

/**
 * Register the tools/execute argument-repair wrapper. The model occasionally
 * drops `description` or emits arguments as unparseable JSON — repair before
 * registry validation turns that into an INVALID_ARGS failure (see tool-args.js).
 * The wrapper never breaks dispatch: any failure falls through to `next()`.
 */
function registerToolRepair(ctx, cfg) {
  if (!cfg.toolRepair.enabled) {
    ctx.logger?.info?.("better-deepseek-harness: tools/execute argument repair is disabled by config");
    return;
  }
  try {
    ctx.on("tools/execute", async (exec, next) => {
      let definition;
      try {
        definition = ctx.tools && typeof ctx.tools.get === "function"
          ? ctx.tools.get(exec.name, exec.agent)
          : void 0;
      } catch (error) {
        // the repair layer must never break dispatch
        ctx.logger?.warn?.("better-deepseek-harness: tool definition lookup failed: %s", error?.message ?? error);
        return next();
      }
      let result;
      try {
        result = repairToolArguments(definition?.parameters, exec.arguments, cfg.toolRepair);
      } catch (error) {
        // the repair layer must never break dispatch
        ctx.logger?.warn?.("better-deepseek-harness: tool argument repair failed: %s", error?.message ?? error);
        return next();
      }
      if (result.changed) {
        // prepare froze the original arguments snapshot; replace the reference
        // (exec itself is mutable — see dsh-tool-call-timeout-policy).
        exec.arguments = result.arguments;
        ctx.logger?.debug?.("better-deepseek-harness: repaired arguments for tool %s", exec.name);
      }
      return next();
    });
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: tools/execute wrapper registration failed: %s", error?.message ?? error);
    return;
  }
  ctx.logger?.info?.("better-deepseek-harness: tools/execute argument-repair wrapper registered");
}

function apply(ctx, config = {}) {
  // Misconfiguration fails loud: an invalid config block rejects the load here.
  const cfg = resolveConfig(config);
  const layout = resolveLayout(ctx, cfg);
  const configOf = () => readConfig(ctx);
  const cx = { layout, configOf, cfg, ctx };

  // 0. tool-call argument repair
  registerToolRepair(ctx, cfg);

  // 0b. image transcription: requests carrying images are described by the
  //     configured vision model before a text-only adapter ever sees them.
  registerVisionListener(ctx, configOf, cfg);

  // 1. settings namespace (native preferences). The registration rides a
  //    scoped fiber that waits for the settings service (the same pattern as
  //    dsh-settings' installSettingsSection): ctx.get("settings") at
  //    apply() time returns undefined while the provider is still starting,
  //    and a one-shot read would silently lose the namespace forever — the
  //    settings tab would stay "loading" with no config fields at all.
  try {
    ctx.inject(["settings"], (sctx) => {
      sctx.settings.register(SETTINGS_NS, SettingsSchema, { base: DEFAULTS });
    });
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: settings namespace registration failed: %s", error?.message ?? error);
  }

  // 2. skill provider for custom directories
  try {
    registerSkillProvider(ctx, configOf);
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: skill provider registration failed: %s", error?.message ?? error);
  }

  // 3. HTTP API
  const handle = async (req, res) => {
    let url;
    try {
      url = new URL(req.url || "/", "http://ext");
    } catch { /* unparseable request target — rejected below as a bad request */ }
    if (url === void 0) return send(res, 400, { ok: false, error: { code: "bad-request", message: "invalid path" } });
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, { ok: false, error: { code: "bad-request", message: "invalid path" } });
    }
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
    let outcome;
    try {
      outcome = { ok: true, value: await route.handler(body, cx, url.searchParams) };
    } catch (error) {
      ctx.logger?.warn?.("better-deepseek-harness: %s failed: %s", pathname, error.message);
      outcome = { ok: false, error: { code: error.code || "internal", message: error.message } };
    }
    send(res, 200, outcome);
  };
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: "/ext/api", handler: handle }), "better-deepseek-harness: api routes");
  ctx.logger?.info?.("better-deepseek-harness: API mounted at /ext/api (profile %s)", layout.profileDir);

  // 4. terminal lifecycle: kill every pty child when the plugin is disposed
  ctx.effect(() => {
    return () => {
      for (const session of terminalSessions.values()) {
        try { session.impl.kill(); } catch { /* already gone */ }
      }
      terminalSessions.clear();
    };
  }, "better-deepseek-harness: terminals");
}

/* ─────────────────────────── file tree ─────────────────────────── */

/**
 * Resolve the file tree root. Priority:
 *   1. an explicit `ext-center.treeRoot` setting;
 *   2. the workspace owning `sessionId` (session-scoped callers such as the
 *      Git tab must never resolve through another session's workspace);
 *   3. the most recently registered workspace (`ctx.workspaceRegistry`,
 *      newest-first durable order — global surfaces such as the file tree);
 *   4. the harness process working directory.
 */
function resolveTreeRoot(ctx, layout, configOf, sessionId) {
  const config = configOf();
  if (config.treeRoot) return resolve(String(config.treeRoot));
  const workspace = resolveWorkspaceRoot(ctx, sessionId);
  if (workspace) return workspace;
  return process.cwd();
}

/**
 * The workspace path a caller should see: the workspace owning `sessionId`
 * when one is given, otherwise the newest registered workspace.
 */
function resolveWorkspaceRoot(ctx, sessionId) {
  let registry;
  try {
    registry = ctx && typeof ctx.get === "function" ? ctx.get("workspaceRegistry") : void 0;
  } catch { /* the workspace registry is optional in this deployment */ }
  if (!registry || typeof registry.list !== "function") return void 0;
  const workspaces = registry.list();
  if (!Array.isArray(workspaces) || workspaces.length === 0) return void 0;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    for (const workspace of workspaces) {
      if (!workspace || typeof workspace !== "object" || typeof workspace.path !== "string" || workspace.path.length === 0) continue;
      const ids = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
      if (ids.includes(sessionId)) return workspace.path;
    }
    // The session is not workspace-accounted: never substitute another
    // workspace — fall through to the process cwd.
    return void 0;
  }
  const root = workspaces[0] && typeof workspaces[0] === "object" ? workspaces[0].path : void 0;
  return typeof root === "string" && root.length > 0 ? root : void 0;
}

function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch { /* unreadable or vanished path — the realpath check is skipped */
    return null;
  }
}

/**
 * Resolve a path inside the tree root. A relative `want` resolves against
 * the root; absolute paths must stay inside it (both a plain resolve check
 * and a realpath check, so `..` tricks and junction escapes fail).
 */
function resolveTreePath(root, want) {
  const target = want ? resolve(root, want) : root;
  if (target !== root && !target.startsWith(root + sep)) {
    throw err("tree-outside-root", "tree path must stay inside the configured root");
  }
  const rootReal = realpathSafe(root);
  const targetReal = realpathSafe(target);
  if (rootReal && targetReal && targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
    throw err("tree-outside-root", "tree path resolves outside the configured root");
  }
  return target;
}

/**
 * List one directory for the file tree. A relative `path` resolves against
 * the tree root; absolute paths must stay inside it (both a plain resolve
 * check and a realpath check, so `..` tricks and junction escapes fail).
 */
function listTreeDir(body, cx, query) {
  const { ctx, layout, configOf, cfg } = cx;
  const root = resolveTreeRoot(ctx, layout, configOf);
  const want = query && typeof query.get === "function" ? String(query.get("path") || "") : "";
  const dir = resolveTreePath(root, want);
  let dirents;
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    throw err("tree-read", "cannot read " + dir + ": " + error.message);
  }
  const entries = [];
  for (const entry of dirents) {
    const name = entry.name;
    if (cfg.tree.ignoreSet.has(name)) continue;
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch { /* vanished or unreadable between readdir and stat */
      continue;
    }
    const isDir = stat.isDirectory();
    entries.push({
      name,
      path: full,
      type: isDir ? "dir" : "file",
      size: isDir ? 0 : stat.size,
      mtime: Math.floor(stat.mtimeMs),
      children: isDir ? countTreeChildren(full, cfg.tree.ignoreSet) : 0
    });
  }
  entries.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
  const truncated = entries.length > cfg.tree.maxEntries;
  if (truncated) entries.length = cfg.tree.maxEntries;
  return { root, dir, name: basename(dir) || dir, entries, truncated, maxEntries: cfg.tree.maxEntries };
}

/** Count non-ignored entries inside one directory (cheap badge for the tree). */
function countTreeChildren(dir, ignoreSet) {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!ignoreSet.has(entry.name)) count += 1;
    }
  } catch { /* unreadable dir: report 0 */ }
  return count;
}

/**
 * Read one tree file for the editor. Refuses directories, files over the
 * 1 MiB ceiling, and binary content (NUL bytes) so the modal only ever shows
 * text it can round-trip.
 */
function readTreeFile(body, cx, query) {
  const { ctx, layout, configOf } = cx;
  const root = resolveTreeRoot(ctx, layout, configOf);
  const want = query && typeof query.get === "function" ? String(query.get("path") || "") : "";
  if (!want) throw err("bad-request", "path is required");
  const file = resolveTreePath(root, want);
  let stat;
  try {
    stat = statSync(file);
  } catch (error) {
    throw err("tree-read", "cannot stat " + file + ": " + error.message);
  }
  if (!stat.isFile()) throw err("tree-not-file", file + " is not a file");
  if (stat.size > MAX_TREE_FILE_SIZE) {
    throw err("tree-too-large", "file is " + stat.size + " bytes — the editor limit is " + MAX_TREE_FILE_SIZE + " bytes");
  }
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    throw err("tree-read", "cannot read " + file + ": " + error.message);
  }
  if (raw.includes("\u0000")) throw err("tree-binary", "binary file (contains NUL bytes) cannot be displayed");
  return { root, path: file, name: basename(file), size: stat.size, content: raw };
}

/**
 * Write one tree file from the editor. Only existing files inside the root are
 * writable; content must stay under the 1 MiB ceiling and be NUL-free. The
 * write is atomic (temp file + rename), so a failed write leaves the original
 * intact.
 */
function writeTreeFile(body, cx) {
  const { ctx, layout, configOf } = cx;
  const requested = typeof body.path === "string" ? body.path.trim() : "";
  if (!requested) throw err("bad-request", "path is required");
  if (typeof body.content !== "string") throw err("bad-request", "content must be a string");
  const root = resolveTreeRoot(ctx, layout, configOf);
  const file = resolveTreePath(root, requested);
  let stat;
  try {
    stat = statSync(file);
  } catch (error) {
    throw err("tree-read", "cannot stat " + file + ": " + error.message);
  }
  if (!stat.isFile()) throw err("tree-not-file", file + " is not a file");
  const bytes = Buffer.byteLength(body.content, "utf8");
  if (bytes > MAX_TREE_FILE_SIZE) {
    throw err("tree-too-large", "file is " + bytes + " bytes — the editor limit is " + MAX_TREE_FILE_SIZE + " bytes");
  }
  if (body.content.includes("\u0000")) throw err("tree-binary", "binary content (contains NUL bytes) cannot be written");
  const tmp = file + ".tmp";
  try {
    writeFileSync(tmp, body.content, "utf8");
    renameSync(tmp, file);
  } catch (error) {
    try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
    throw err("tree-write", "cannot write " + file + ": " + error.message);
  }
  return { path: file, name: basename(file), size: bytes };
}

/* ─────────────────────────── route handlers ─────────────────────────── */

function snapshotState(cx) {
  const { layout, configOf, ctx, cfg } = cx;
  const config = configOf();
  const state = loadState(layout);
  const manifest = profileManifest(layout);
  const entries = [];
  let loader;
  try {
    loader = ctx.get("loader");
  } catch { /* loader inspection is best-effort */ }
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
    version: PLUGIN_VERSION,
    dshHome: layout.dshHome,
    profileDir: layout.profileDir,
    pluginRoot: layout.pluginRoot,
    patchFile: layout.patchFile,
    skillRoots: skillRootsOf(layout, config).map((r) => ({ path: r.path, source: r.source })),
    config,
    settingsWritable: (() => {
      let settings;
      try {
        settings = ctx.get("settings");
      } catch { /* the settings service is optional in this deployment */ }
      return settings ? settings.writable !== false : false;
    })(),
    limits: {
      treeMaxEntries: cfg.tree.maxEntries,
      treeMaxFileSize: MAX_TREE_FILE_SIZE,
      terminalMaxSessions: cfg.terminal.maxSessions,
      terminalWriteLimit: TERMINAL_WRITE_LIMIT,
      gitLogMax: cfg.git.logMax,
      mcpMaxServers: cfg.mcp.maxServers,
      terminalPollMs: cfg.client.terminalPollMs,
      terminalListPollMs: cfg.client.terminalListPollMs,
      gitPollMs: cfg.client.gitPollMs,
      mcpPollMs: cfg.client.mcpPollMs
    },
    llmProviders: (() => {
      let llm;
      try {
        llm = ctx.get("llm");
      } catch { /* the llm service is optional in this deployment */ }
      if (llm && typeof llm.listProviders === "function") {
        return llm.listProviders().map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? p.id ?? "") }));
      }
      return [];
    })(),
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
    handler: (body, cx) => snapshotState(cx)
  },
  "/ext/api/tree": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => listTreeDir(body, cx, query)
  },
  "/ext/api/tree/content": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => readTreeFile(body, cx, query)
  },
  "/ext/api/tree/write": {
    method: "POST",
    readsBody: true,
    mutating: true,
    requiresLocal: true,
    handler: (body, cx) => writeTreeFile(body, cx)
  },
  "/ext/api/terminal/list": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: () => ({
      terminals: [...terminalSessions.values()]
        .map((s) => ({
          id: s.id,
          kind: s.kind,
          cwd: s.cwd,
          alive: !s.dead,
          exitCode: s.dead ? s.exitCode : null,
          createdAt: s.createdAt
        }))
        .sort((a, b) => a.createdAt - b.createdAt)
    })
  },
  "/ext/api/terminal/create": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => {
      const { ctx, layout, configOf, cfg } = cx;
      const kind = typeof body.kind === "string" ? body.kind : "";
      const root = resolveTreeRoot(ctx, layout, configOf);
      const session = createTerminalSession(kind, root, cfg);
      return { id: session.id, kind: session.kind, cwd: root };
    }
  },
  "/ext/api/terminal/write": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body) => {
      const session = terminalSessions.get(typeof body.id === "string" ? body.id : "");
      if (!session) throw err("not-found", "no such terminal");
      if (session.dead) throw err("term-dead", "terminal has exited");
      const data = typeof body.data === "string" ? body.data : "";
      if (data.length > TERMINAL_WRITE_LIMIT) throw err("bad-request", "input exceeds " + TERMINAL_WRITE_LIMIT + " characters");
      try {
        session.impl.write(data);
      } catch (error) {
        throw err("term-write", "cannot write to terminal: " + error.message);
      }
      return { id: session.id };
    }
  },
  "/ext/api/terminal/resize": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body) => {
      const session = terminalSessions.get(typeof body.id === "string" ? body.id : "");
      if (!session) throw err("not-found", "no such terminal");
      const cols = Number(body.cols);
      const rows = Number(body.rows);
      if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
        session.impl.resize(Math.floor(cols), Math.floor(rows));
      }
      return { id: session.id };
    }
  },
  "/ext/api/terminal/kill": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body) => {
      const id = typeof body.id === "string" ? body.id : "";
      const session = terminalSessions.get(id);
      if (session) {
        try { session.impl.kill(); } catch { /* ignore */ }
        terminalSessions.delete(id);
      }
      return { id }; // idempotent: killing an unknown terminal is a no-op
    }
  },
  "/ext/api/terminal/output": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => {
      const get = query && typeof query.get === "function" ? query.get.bind(query) : () => null;
      const session = terminalSessions.get(String(get("id") || ""));
      if (!session) throw err("not-found", "no such terminal");
      const after = Number(get("after") || 0);
      return terminalOutput(session, Number.isFinite(after) ? after : 0);
    }
  },
  "/ext/api/config": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, cx) => {
      const { ctx } = cx;
      const settings = ctx.get("settings");
      if (!settings || (typeof settings.mutate !== "function" && typeof settings.update !== "function")) {
        throw err("settings-unavailable", "the settings service is not mounted");
      }
      const patch = {};
      for (const key of ["allowLan", "skillRoot", "customSkillDirs", "treeRoot", "vision"]) {
        if (key in body) {
          const value = body[key];
          if (key === "allowLan" && typeof value !== "boolean") throw err("bad-request", "allowLan must be a boolean");
          if (key === "skillRoot" && typeof value !== "string") throw err("bad-request", "skillRoot must be a string");
          if (key === "treeRoot" && typeof value !== "string") throw err("bad-request", "treeRoot must be a string");
          if (key === "customSkillDirs" && (!Array.isArray(value) || value.some((v) => typeof v !== "string"))) throw err("bad-request", "customSkillDirs must be an array of strings");
          if (key === "vision" && (typeof value !== "object" || value === null || Array.isArray(value))) throw err("bad-request", "vision must be an object");
          patch[key] = value;
        }
      }
      const resets = [];
      if (body.reset !== void 0) {
        if (!Array.isArray(body.reset) || body.reset.some((v) => typeof v !== "string")) {
          throw err("bad-request", "reset must be an array of strings");
        }
        for (const key of body.reset) {
          if (!["allowLan", "skillRoot", "customSkillDirs", "treeRoot", "vision"].includes(key)) {
            throw err("bad-request", `unknown settings key \"${key}\"`);
          }
          resets.push(key);
        }
      }
      const ops = [];
      for (const [key, value] of Object.entries(patch)) ops.push({ op: "set", path: [key], value });
      for (const key of resets) ops.push({ op: "unset", path: [key] });
      if (ops.length > 0) {
        if (typeof settings.mutate === "function") {
          await settings.mutate(SETTINGS_NS, ops);
        } else {
          if (resets.length > 0) throw err("settings-unavailable", "this settings provider cannot clear fields");
          await settings.update(SETTINGS_NS, patch);
        }
      }
      const skills = ctx.get("skills");
      if (skills && typeof skills.invalidateCache === "function") skills.invalidateCache();
      return snapshotState(cx);
    }
  },
  "/ext/api/skill/install": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, cx) => {
      const { layout, configOf, ctx } = cx;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || !SKILL_NAME_RE.test(name)) throw err("bad-request", `invalid skill name \"${name}\". Use lowercase kebab-case.`);
      const root = resolveSkillRoot(layout, configOf());
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
    handler: async (body, cx) => {
      const { layout, configOf } = cx;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || !SKILL_NAME_RE.test(name)) throw err("bad-request", "invalid skill name");
      const root = resolveSkillRoot(layout, configOf());
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
    handler: async (body, cx) => {
      const { layout, ctx } = cx;
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
        if (pkgName === NAME) throw err("already-installed", NAME + " is built in");
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
      const raw = readPatchRaw(layout);

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
      let loader;
      try {
        loader = ctx.get("loader");
      } catch { /* loader inspection is best-effort */ }
      if (loader && typeof loader.entries === "function") for (const entry of loader.entries()) existingIds.add(String(entry.id));
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
    handler: async (body, cx) => {
      const { layout, ctx } = cx;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw err("bad-request", "name is required");
      if (name === NAME) throw err("forbidden", NAME + " cannot be uninstalled from itself");
      const state = loadState(layout);
      const record = state[name];
      if (!record) throw err("not-found", `${name} is not tracked by the extension center`);
      const list = loadPatchList(layout);
      const raw = readPatchRaw(layout);
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
    handler: async (body, cx) => {
      const { layout, ctx } = cx;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw err("bad-request", "name is required");
      if (name === NAME) throw err("forbidden", NAME + " cannot be disabled");
      const enabled = body.enabled !== false;
      const state = loadState(layout);
      const record = state[name];
      if (!record) throw err("not-found", `${name} is not tracked by the extension center`);
      const list = loadPatchList(layout);
      const raw = readPatchRaw(layout);
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
  },
  "/ext/api/git/status": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => gitStatus(body, cx, query)
  },
  "/ext/api/git/diff": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => gitDiff(body, cx, query)
  },
  "/ext/api/git/log": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => gitLog(body, cx, query)
  },
  "/ext/api/git/branches": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx, query) => gitBranches(body, cx, query)
  },
  "/ext/api/git/stage": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitStage(body, cx)
  },
  "/ext/api/git/stage-all": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => runGit(requireGitRoot(cx, gitSessionId(body, void 0)), ["add", "-A"], cx.cfg.git.timeoutMs).then(() => ({ ok: true }))
  },
  "/ext/api/git/unstage": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitUnstage(body, cx)
  },
  "/ext/api/git/unstage-all": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => runGit(requireGitRoot(cx, gitSessionId(body, void 0)), ["reset"], cx.cfg.git.timeoutMs).then(() => ({ ok: true }))
  },
  "/ext/api/git/commit": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitCommit(body, cx)
  },
  "/ext/api/git/discard": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitDiscard(body, cx)
  },
  "/ext/api/git/checkout": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitCheckout(body, cx)
  },
  "/ext/api/git/pull": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitPull(body, cx)
  },
  "/ext/api/git/push": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => gitPush(body, cx)
  },
  "/ext/api/mcp/list": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (body, cx) => mcpSnapshot(body, cx)
  },
  "/ext/api/mcp/add": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => mcpAdd(body, cx)
  },
  "/ext/api/mcp/remove": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => mcpRemove(body, cx)
  },
  "/ext/api/mcp/set-enabled": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => mcpSetEnabled(body, cx)
  }
};

export { NAME, SETTINGS_NS, apply, inject };
