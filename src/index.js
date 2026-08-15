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
 *     up after a page refresh). Git sources that do not commit their built
 *     output (no lib/) are built at install time (npm install + npm run build)
 *     so the declared entry point always exists before activation.
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
  lstatSync,
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
import { defineTool } from "@deepseek-ai/dsh-tools";
import { repairToolArguments } from "./tool-args.js";
import { stripAnsiChunk } from "./ansi.js";
import { appendTerminalBuffer, createTerminalBuffer, terminalBufferSlice } from "./terminal-buffer.js";
import {
  TAVILY_API_URL,
  TAVILY_DEFAULTS,
  TAVILY_MAX_RESULTS_MAX,
  TAVILY_MAX_RESULTS_MIN,
  buildTavilyRequestBody,
  formatTavilyOutput,
  mapTavilyResponse,
  resolveTavilySettings,
  validateTavilyApiKey
} from "./tavily.js";
import {
  GITHUB_DEFAULTS,
  GITHUB_RELEASES_CAP,
  GITHUB_RELEASE_BODY_CAP,
  GITHUB_SEARCH_CAP,
  GITHUB_TIMEOUT_MAX,
  GITHUB_TIMEOUT_MIN,
  GITHUB_TOKEN_MAX_LENGTH,
  formatGithubFileOutput,
  formatGithubReleasesOutput,
  formatGithubRepoOutput,
  formatGithubSearchOutput,
  formatGithubTreeOutput,
  githubContentsUrl,
  githubErrorMessage,
  githubHeaders,
  githubReleasesUrl,
  githubRepoUrl,
  githubSearchUrl,
  mapGithubContentsResponse,
  mapGithubReleasesResponse,
  mapGithubRepoResponse,
  mapGithubSearchResponse,
  parseRepoRef,
  resolveGithubSettings,
  validateGithubPath,
  validateGithubToken
} from "./github.js";
import {
  RESCUE_FILE,
  RESCUE_STATE_VERSION,
  buildRescuePlan,
  buildRestorePlan,
  emptyRescueState,
  markBootHealthy,
  patchListIds,
  patchRowIds,
  previousBootFailed,
  rescueStatusView,
  sanitizeRescueState,
  startupProblems,
  withBoot
} from "./rescue.js";
import { detectDshWebUi, dshWebUiSuppression, emptyDshWebUiPresence } from "./compat.js";

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
    const text = typeof data === "string" ? data : data.toString("utf8");
    const stripped = stripAnsiChunk(text, session.ansiTail);
    session.ansiTail = stripped.tail;
    appendTerminalBuffer(session.ring, stripped.text, bufferLimit);
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
    ring: createTerminalBuffer(),
    ansiTail: "",
    dead: false,
    exitCode: null,
    impl: null
  };
  try {
    spawner(session, shell, cwd, cfg.terminal.bufferLimit);
  } catch (error) {
    throw err("term-spawn", "cannot start " + shell.file + ": " + (error?.message ?? String(error)));
  }
  terminalSessions.set(session.id, session);
  return session;
}

function terminalOutput(session, after) {
  const { text, cursor } = terminalBufferSlice(session.ring, after);
  return {
    id: session.id,
    alive: !session.dead,
    exitCode: session.dead ? session.exitCode : null,
    text,
    cursor
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
/** Ceiling on one batch of archived-session deletions (security invariant). */
const ARCHIVE_BATCH_MAX = 500;
/** Ceiling on one source build run (npm install / npm run build) during a git install. */
const SOURCE_BUILD_TIMEOUT = 600_000; // 10 minutes
/** Cap on the captured subprocess output tail kept for build-error reporting. */
const SOURCE_BUILD_TAIL = 16 * 1024;
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
    apiKey: "",
    maxImages: 4,
    maxTokens: 1024
  }),
  tavily: TAVILY_DEFAULTS,
  github: GITHUB_DEFAULTS
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
  }).default({}),
  rescue: z.object({
    /** Master switch: false disables auto rescue mode entirely. */
    enabled: z.boolean().default(true),
    /** Startup settle window (ms): a boot is declared healthy only after this delay passes without startup problems. */
    settleMs: z.number().min(3000).max(120000).default(12000),
    /** Third-party bundle layers rescue mode must never disable (host front doors). Headless/TUI hosts auto-protect the self-mounted front-door bundle; this list is the explicit escape hatch for deployments where auto-detection cannot see it. */
    protectBundles: z.array(z.string().min(1)).default([])
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
    apiKey: z.string().default(DEFAULTS.vision.apiKey),
    maxImages: z.number().min(1).max(32).default(DEFAULTS.vision.maxImages),
    maxTokens: z.number().min(64).max(8192).default(DEFAULTS.vision.maxTokens)
  }).default({ ...DEFAULTS.vision }),
  tavily: z.object({
    enabled: z.boolean().default(DEFAULTS.tavily.enabled),
    apiKey: z.string().default(DEFAULTS.tavily.apiKey),
    searchDepth: z.union(["basic", "advanced"]).default(DEFAULTS.tavily.searchDepth),
    maxResults: z.number().min(TAVILY_MAX_RESULTS_MIN).max(TAVILY_MAX_RESULTS_MAX).default(DEFAULTS.tavily.maxResults),
    includeRaw: z.boolean().default(DEFAULTS.tavily.includeRaw)
  }).default({ ...DEFAULTS.tavily }),
  github: z.object({
    enabled: z.boolean().default(DEFAULTS.github.enabled),
    token: z.string().default(DEFAULTS.github.token),
    timeoutMs: z.number().min(GITHUB_TIMEOUT_MIN).max(GITHUB_TIMEOUT_MAX).default(DEFAULTS.github.timeoutMs)
  }).default({ ...DEFAULTS.github })
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
  const rescueFile = join(profileDir, RESCUE_FILE);
  const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), ".agents");
  return {
    profileDir,
    dshHome,
    profilesDir,
    pluginRoot,
    patchFile,
    stateFile,
    manifestFile,
    rescueFile,
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
  const storedSection = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  // Hand-edited settings.yaml may carry partial nested sections; keep the
  // documented defaults inside vision/tavily instead of replacing the whole
  // section and losing fields the UI did not mention.
  const vision = storedSection.vision && typeof storedSection.vision === "object" && !Array.isArray(storedSection.vision)
    ? { ...DEFAULTS.vision, ...storedSection.vision }
    : { ...DEFAULTS.vision };
  const tavily = storedSection.tavily && typeof storedSection.tavily === "object" && !Array.isArray(storedSection.tavily)
    ? { ...DEFAULTS.tavily, ...storedSection.tavily }
    : { ...DEFAULTS.tavily };
  const github = storedSection.github && typeof storedSection.github === "object" && !Array.isArray(storedSection.github)
    ? { ...DEFAULTS.github, ...storedSection.github }
    : { ...DEFAULTS.github };
  return { ...DEFAULTS, ...storedSection, vision, tavily, github };
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

let patchWriteChain = Promise.resolve();

/**
 * Serialize a full patch-file mutation: the mutator runs under a promise
 * chain so concurrent API requests cannot interleave their read-modify-write
 * snapshots (the harness config watcher wedges when overlapping refreshes
 * land). Successive writes keep the small gap the watcher needs. The mutator
 * receives a fresh list plus the raw header source and returns its outcome.
 */
async function withPatchWrite(layout, mutator) {
  let result;
  const run = async () => {
    const wait = Math.max(0, PATCH_WRITE_GAP_MS - (Date.now() - lastPatchWriteAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const raw = readPatchRaw(layout);
    const list = loadPatchList(layout);
    result = await mutator(list, raw);
    savePatchList(layout, list, raw);
    lastPatchWriteAt = Date.now();
  };
  const task = patchWriteChain.then(run, run);
  patchWriteChain = task.then(() => {}, () => { /* a failed write must not wedge later writes */ });
  await task;
  return result;
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

/**
 * True when every non-group, non-disabled loader entry already has a settled
 * fiber — the tree has converged. An empty tree counts as settled.
 */
function loaderSettled(entries) {
  for (const entry of entries) {
    if (entry.options?.group) continue;
    if (entry.disabled === true) continue;
    const state = entry.fiber?.state;
    if (state === void 0 || state === 0 || state === 1) return false;
  }
  return true;
}

/**
 * Wait until the loader tree settles (or the timeout elapses). The
 * dsh-web-ui compatibility gate decides after the tree settles because a
 * sibling bundle may still be pending when this plugin's apply() runs, and a
 * pending entry is indistinguishable from an absent one. A deployment without
 * a loader service returns immediately — the gate's initial snapshot stays
 * authoritative (fail-open).
 */
async function waitForLoaderSettled(ctx, timeoutMs = 8000) {
  let loader;
  try {
    loader = ctx.get("loader");
  } catch { /* loader inspection is best-effort */ }
  if (!loader || typeof loader.entries !== "function") return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (loaderSettled(loader.entries())) return true;
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
 * Find a patch row by deep equality first, then by canonical signature
 * (covers rows whose surrounding fields were touched by hand edits).
 * @returns the row index, or -1 when absent.
 */
function findRowIndex(list, row) {
  let at = list.findIndex((existing) => deepEqualJson(existing, row));
  if (at === -1) at = list.findIndex((existing) => entrySignature(existing) === entrySignature(row));
  return at;
}

/**
 * Append patch entries, skipping entries already present (by deep equality)
 * and insert-rows whose id already exists anywhere in the composition
 * (duplicate row ids would break the loader tree).
 */
function mergePatchEntries(list, rows, existingIds) {
  const added = [];
  for (const row of rows) {
    if (findRowIndex(list, row) !== -1) continue;
    if (Array.isArray(row.insert)) {
      const freshRows = row.insert.filter((entry) => !(entry && typeof entry === "object" && entry.id && existingIds.has(String(entry.id))));
      if (freshRows.length === 0) continue;
      const merged = { ...row, insert: freshRows };
      list.push(merged);
      added.push(merged);
      for (const entry of freshRows) if (entry && entry.id) existingIds.add(String(entry.id));
    } else {
      if (row && typeof row === "object" && row.id && existingIds.has(String(row.id))) continue;
      list.push(row);
      added.push(row);
    }
  }
  return added;
}

/* ─────────────────────────── sidecar state ─────────────────────────── */

function loadState(layout) {
  const plugins = Object.create(null);
  try {
    const parsed = JSON.parse(readFileSync(layout.stateFile, "utf8"));
    if (parsed && parsed.version === STATE_VERSION && parsed.plugins && typeof parsed.plugins === "object") {
      // A null-prototype map keeps hostile package names ("__proto__" etc.)
      // from mutating the prototype instead of the tracked-plugin entry.
      for (const [name, record] of Object.entries(parsed.plugins)) plugins[name] = record;
    }
  } catch { /* absent or malformed */ }
  return plugins;
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

/** Enumerate the valid skills (directory SKILL.md or one .md file) in one root. */
function readSkillsInDir(rootPath) {
  const skills = [];
  let entries = [];
  try {
    entries = readdirSync(rootPath, { withFileTypes: true });
  } catch { /* absent root — no skills */ }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(rootPath, entry.name);
    const skill = entry.isDirectory()
      ? readSkillFile(join(full, "SKILL.md"))
      : entry.isFile() && entry.name.endsWith(".md") ? readSkillFile(full) : void 0;
    if (skill) skills.push(skill);
  }
  return skills;
}

function listSkills(layout, config) {
  const skills = [];
  for (const root of skillRootsOf(layout, config)) {
    for (const skill of readSkillsInDir(root.path)) {
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
  if (manifest.name === "__proto__" || manifest.name === "constructor" || manifest.name === "prototype") {
    throw err("package-invalid", `package name \"${manifest.name}\" collides with a JavaScript prototype member`);
  }
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
    if (targetName.includes("\0")) throw err("archive-invalid", "tar entry name contains NUL bytes");
    if (type === "L") {
      // GNU long name extension: payload is the real name
      const longName = buffer.toString("utf8", dataStart, dataEnd).replace(/\0+$/, "");
      if (longName === "" || longName.includes("\0")) throw err("archive-invalid", "invalid long tar entry name");
      offset = dataEnd + ((512 - (size % 512)) % 512);
      // The next header carries the actual content under the long name.
      if (offset + 512 > buffer.length) throw err("archive-invalid", "truncated tar archive");
      const nextHeader = buffer.subarray(offset, offset + 512);
      const nextSize = parseInt(readStr(offset + 124, 12).trim() || "0", 8) || 0;
      const nextType = String.fromCharCode(nextHeader[156] ?? 48);
      const nextDataStart = offset + 512;
      const nextDataEnd = nextDataStart + nextSize;
      if (nextDataEnd > buffer.length) throw err("archive-invalid", "truncated tar archive");
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
  const gzipByMagic = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  // Only the magic bytes decide: fetch already transparently decompresses a
  // content-encoding response while leaving the header in place, so honoring
  // the header would double-decompress a valid tarball.
  if (!gzipByMagic) return buf;
  try {
    return gunzipSync(buf);
  } catch (error) {
    throw err("archive-invalid", `tarball is not valid gzip: ${error.message}`);
  }
}

async function npmTarballUrl(spec) {
  const at = spec.lastIndexOf("@");
  const hasScope = spec.startsWith("@");
  const version = hasScope ? (at > spec.indexOf("/") ? spec.slice(at + 1) : void 0) : (at > 0 ? spec.slice(at + 1) : void 0);
  const name = version === void 0 ? spec : spec.slice(0, spec.length - version.length - 1);
  if (!name || !PKG_NAME_RE.test(name)) throw err("registry-failed", `invalid npm package spec \"${spec}\"`);
  if (version === "") throw err("registry-failed", `invalid npm package spec \"${spec}\": empty version`);
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

/* ─────────────────────── source build fallback ─────────────────────── */

/**
 * The package's declared JS entry points as repo-relative paths, resolved
 * from `main` and `exports["."]` (string, fallback array, or condition
 * object with import/require/default). Returns [] when nothing is declared —
 * then the loader's own resolution decides and no build is attempted.
 */
function packageEntryPoints(manifest) {
  const out = [];
  if (typeof manifest.main === "string" && manifest.main.trim() !== "") out.push(manifest.main);
  const exportsDot = manifest.exports && typeof manifest.exports === "object" ? manifest.exports["."] : void 0;
  if (typeof exportsDot === "string") {
    out.push(exportsDot);
  } else if (Array.isArray(exportsDot)) {
    for (const entry of exportsDot) {
      if (typeof entry === "string") { out.push(entry); break; }
    }
  } else if (exportsDot && typeof exportsDot === "object") {
    for (const key of ["import", "require", "default", "node", "browser"]) {
      const value = exportsDot[key];
      if (typeof value === "string") { out.push(value); break; }
      if (value && typeof value === "object") {
        const inner = value["default"] ?? value["import"] ?? value["require"];
        if (typeof inner === "string") { out.push(inner); break; }
      }
    }
  }
  return out;
}

/** True when at least one declared entry point exists in the package dir. */
function packageEntryExists(dir, manifest) {
  const entries = packageEntryPoints(manifest);
  if (entries.length === 0) return true; // undeterminable — leave it to the loader
  return entries.some((rel) => existsSync(join(dir, rel.replace(/\//g, sep))));
}

/** The npm executable name for this platform (.cmd shim on Windows). */
function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * Run a subprocess, capturing a bounded tail of its output. Resolves on exit
 * code 0; rejects with { code, message, tail } on spawn failure, timeout, or
 * a non-zero exit.
 */
function runCommandCapture(cmd, args, cwd, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, npm_config_update_notifier: "false" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32"
    });
    const tailOf = (() => {
      let buffer = Buffer.alloc(0);
      return (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        return buffer.length > SOURCE_BUILD_TAIL ? buffer.subarray(buffer.length - SOURCE_BUILD_TAIL) : buffer;
      };
    })();
    let stdoutTail = Buffer.alloc(0);
    let stderrTail = Buffer.alloc(0);
    let timedOut = false;
    child.stdout.on("data", (chunk) => { stdoutTail = tailOf(chunk); });
    child.stderr.on("data", (chunk) => { stderrTail = tailOf(chunk); });
    const killTree = () => {
      try {
        if (process.platform === "win32" && child.pid) {
          spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          child.kill();
        }
      } catch { /* already gone */ }
    };
    const timer = setTimeout(() => { timedOut = true; killTree(); }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject({ code: "spawn", message: error.message, tail: stderrTail.toString("utf8").trim() });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = stdoutTail.toString("utf8").trim();
      const stderr = stderrTail.toString("utf8").trim();
      if (code !== 0) {
        reject({ code: timedOut ? "timeout" : "failed", message: `exited with code ${code}`, tail: stderr || stdout });
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

/**
 * Build fallback for git installs: a repository may not commit its built
 * output (no lib/), so the declared entry point is missing. Install
 * dependencies (which also runs `prepare`), then run the package's `build`
 * script when the entry is still absent. Returns true when a build ran.
 * @param dir - the staged package directory.
 * @param manifest - its parsed package.json.
 * @param run - injectable subprocess runner (tests).
 */
async function ensureBuiltPackage(dir, manifest, run = runCommandCapture) {
  if (packageEntryExists(dir, manifest)) return false;
  const scripts = manifest.scripts && typeof manifest.scripts === "object" ? manifest.scripts : {};
  try {
    await run(npmExecutable(), ["install", "--no-audit", "--no-fund"], dir, SOURCE_BUILD_TIMEOUT);
  } catch (error) {
    if (error && error.code === "spawn") throw err("build-tool-missing", "npm is not available on this machine — install a git repo that ships its built output, or use a tarball URL / npm spec instead");
    throw err("build-failed", `npm install failed (${error?.message ?? error})` + (error?.tail ? ` — ${error.tail}` : ""));
  }
  if (packageEntryExists(dir, manifest)) return true;
  const buildScript = typeof scripts.build === "string" ? scripts.build.trim() : "";
  if (buildScript === "") {
    throw err("build-failed", `the repository does not commit its built output (${packageEntryPoints(manifest).join(", ")} missing) and declares no \"build\" script — install the published npm package or a tarball URL instead`);
  }
  try {
    await run(npmExecutable(), ["run", "build"], dir, SOURCE_BUILD_TIMEOUT);
  } catch (error) {
    throw err("build-failed", `npm run build failed (${error?.message ?? error})` + (error?.tail ? ` — ${error.tail}` : ""));
  }
  if (!packageEntryExists(dir, manifest)) {
    throw err("build-failed", `\"npm run build\" finished but the declared entry (${packageEntryPoints(manifest).join(", ")}) is still missing — install the published npm package or a tarball URL instead`);
  }
  return true;
}

async function materializePackage(source, stagingDir) {
  mkdirSync(stagingDir, { recursive: true });
  let builtFromSource = false;
  switch (source.kind) {
    case "folder": {
      const src = resolve(String(source.path ?? ""));
      if (!existsSync(src) || !statSync(src).isDirectory()) throw err("source-not-found", `folder not found: ${source.path}`);
      // cpSync copies a source directory *into* an existing destination, so
      // remove the empty staging dir first: cpSync then recreates it with the
      // package's files at its root (package.json must sit at stagingDir/package.json).
      rmSync(stagingDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
      // A git repo may not commit its build output (no lib/): build it here so
      // the package's declared entry point exists before it is installed.
      builtFromSource = await ensureBuiltPackage(stagingDir, readPackageManifest(stagingDir));
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
    rmSync(wrapped, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  return { manifest: readPackageManifest(stagingDir), builtFromSource };
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
        for (const skill of readSkillsInDir(resolve(dir))) {
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
    const at = findRowIndex(list, row);
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
        const parsed = JSON.parse(text);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(err("bad-request", "JSON body must be an object"));
          return;
        }
        resolvePromise(parsed);
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
  const { ctx, configOf } = cx;
  let probe;
  try {
    probe = resolveTreeRoot(ctx, configOf, sessionId);
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

/** Run one non-interactive sync command and summarize its trailing output lines. */
function gitSyncSummary(root, args, cx) {
  return runGit(root, args, cx.cfg.git.timeoutMs)
    .then((out) => ({ summary: out.trim().split("\n").filter(Boolean).slice(-3) }));
}

function gitPull(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  return gitSyncSummary(root, ["pull", "--ff-only"], cx);
}

function gitPush(body, cx) {
  const root = requireGitRoot(cx, gitSessionId(body, void 0));
  return gitSyncSummary(root, ["push"], cx);
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
  const out = Object.create(null);
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
function mcpSnapshot(cx) {
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
  await withPatchWrite(layout, (list) => {
    const managed = mcpRowsIn(list).filter(({ entry }) => String(entry.id).startsWith(MCP_ROW_ID_PREFIX)).length;
    if (managed >= cfg.mcp.maxServers) throw err("mcp-cap", "too many MCP servers (max " + cfg.mcp.maxServers + ") — remove one first");
    const existingIds = new Set(patchListIds(list));
    for (const [id] of mcpLoaderEntries(ctx)) existingIds.add(id);
    if (existingIds.has(rowId)) throw err("already-exists", "an MCP server named \"" + name + "\" already exists");
    mergePatchEntries(list, [{ insert: [{ id: rowId, name: "@deepseek-ai/dsh-mcp-client", config }] }], existingIds);
  });
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
  let removed = 0;
  await withPatchWrite(layout, (list) => {
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
  });
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
  await withPatchWrite(layout, (list) => {
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
  });
  const applied = await waitForLoaderState(ctx, (entries) => {
    for (const entry of entries) if (String(entry.id) === rowId) return entry.disabled === !enabled;
    return false;
  });
  return { name, enabled, appliedLive: applied, restartNeeded: !applied };
}

/* ─────────────────────────── image transcription ─────────────────────────── */

/** Default instruction the vision model receives for one image. */
const VISION_DEFAULT_PROMPT = "请详细描述这张图片的全部内容，包括其中的文字、图表、界面元素与细节，供无法直接查看图片的模型使用。";
/** Accepted range for the user-level maxTokens setting (mirrors the ConfigSchema bounds). */
const VISION_MAX_TOKENS_MIN = 64;
const VISION_MAX_TOKENS_MAX = 8192;
/** Normalize the user-configured vision profile (partial settings survive). */
function visionConfigOf(config, cfg) {
  const raw = config && typeof config.vision === "object" && config.vision !== null ? config.vision : {};
  const maxImages = Math.min(Math.max(Number(raw.maxImages) || DEFAULTS.vision.maxImages, 1), cfg.vision.maxImagesCap);
  const userMaxTokens = Number(raw.maxTokens);
  const maxTokens = Number.isFinite(userMaxTokens) && userMaxTokens >= VISION_MAX_TOKENS_MIN && userMaxTokens <= VISION_MAX_TOKENS_MAX
    ? Math.floor(userMaxTokens)
    : cfg.vision.maxTokens;
  return {
    enabled: raw.enabled === true,
    provider: typeof raw.provider === "string" ? raw.provider.trim() : "",
    model: typeof raw.model === "string" ? raw.model.trim() : "",
    prompt: typeof raw.prompt === "string" && raw.prompt.trim() !== "" ? raw.prompt.trim() : VISION_DEFAULT_PROMPT,
    apiUrl: typeof raw.apiUrl === "string" ? raw.apiUrl.trim() : "",
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
    maxImages,
    maxTokens
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

/** Whether the configured profile would actually transcribe this request. */
function visionProfileReady(vision) {
  if (!vision || vision.enabled !== true || vision.model === "") return false;
  return vision.provider === "custom" ? vision.apiUrl !== "" : vision.provider !== "";
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

/** Collect the visible text of one stream, surfacing provider failures. */
async function collectStreamText(stream) {
  let text = "";
  let sawDelta = false;
  for await (const chunk of stream) {
    if (!chunk || typeof chunk !== "object") continue;
    if (chunk.type === "text-delta" && typeof chunk.text === "string") {
      if (!sawDelta) {
        // A whole-text fallback may have arrived first; deltas are the
        // authoritative streaming form, so discard the fallback copy.
        sawDelta = true;
        text = "";
      }
      text += chunk.text;
    } else if (!sawDelta && chunk.type === "text" && typeof chunk.text === "string") {
      // Fallback for adapters/middleware that only emit whole text blocks.
      text += chunk.text;
    } else if (!sawDelta && chunk.type === "block-end" && chunk.block && chunk.block.type === "text" && typeof chunk.block.text === "string") {
      text += chunk.block.text;
    } else if (chunk.type === "finish") {
      const reason = chunk.reason;
      if (reason && (reason.kind === "error" || reason.kind === "aborted")) {
        const failure = reason.failure;
        throw err("llm-failed", (failure && failure.message) || `model stream finished with ${reason.kind}`);
      }
      break;
    }
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
async function customVisionText(ctx, vision, imageBlock, signal) {
  const endpoint = customVisionEndpoint(vision.apiUrl);
  if (!CUSTOM_VISION_URL_RE.test(endpoint)) {
    throw new Error("vision API URL must start with http:// or https://");
  }
  const dataUrl = await imageDataUrl(ctx, imageBlock.attachment, signal);
  const headers = { "content-type": "application/json" };
  if (vision.apiKey) headers.authorization = `Bearer ${vision.apiKey}`;
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: vision.model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: vision.prompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }],
        max_tokens: vision.maxTokens,
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
  const message = json?.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content.trim() : "";
  if (content !== "") return content;
  // Some reasoning models answer entirely in the thinking field while
  // `content` stays empty — for transcription the thinking text is the
  // image description, so fall back to it before declaring failure.
  const reasoning = typeof message?.reasoning === "string" ? message.reasoning : typeof message?.reasoning_content === "string" ? message.reasoning_content : "";
  if (reasoning.trim() !== "") return reasoning.trim();
  // Surface the endpoint's own error detail (e.g. a quota or format error
  // carried in a 200 body) so the failure is diagnosable from the transcript.
  let detail = "";
  if (json && typeof json === "object") {
    detail = typeof json.error?.message === "string" ? json.error.message : JSON.stringify(json).slice(0, 300);
  }
  throw new Error("custom vision endpoint returned no text content" + (detail ? ": " + detail : ""));
}

/** One transcription call: the vision prompt plus a single image block. */
function buildVisionRequest(vision, imageBlock, sessionId, signal) {
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
    maxTokens: vision.maxTokens,
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
async function transcribeRequest(ctx, llm, options, vision) {
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
            described = await customVisionText(ctx, vision, image, options.signal);
          } else {
            const request = buildVisionRequest(vision, image, options.sessionId, options.signal);
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
 *
 * @param isVisionSuppressed - live dsh-web-ui gate: when the family's
 *   describe-image is ACTIVE it owns image understanding (its send hook
 *   rewrites image sends client-side), so transcription stays inert.
 */
function registerVisionListener(ctx, configOf, cfg, isVisionSuppressed = () => false) {
  try {
    // The waterfall contract: every llm/stream listener returns the next
    // listener's value, and the outermost return value must be an async
    // iterable — dsh-agent-loop consumes it with for-await and sibling
    // middleware with yield* next(). An async callback that returns
    // llm.stream(...) yields a Promise and breaks every session
    // ("yield* ... is not async iterable"), so the transcribed path is an
    // async generator and the pass-through path forwards next() untouched.
    ctx.on("llm/stream", (options, next) => {
      if (isVisionSuppressed()) return next();
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
        const rewritten = await transcribeRequest(ctx, llm, options, vision);
        yield* llm.stream(rewritten);
      })();
    }, { global: true });
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: llm/stream wrapper registration failed: %s", error?.message ?? error);
    return;
  }
  ctx.logger?.info?.("better-deepseek-harness: llm/stream image-transcription wrapper registered");
}

/* ─────────────────────────── vision capability bridge ─────────────────────────── */

/**
 * The host api-gateway (dsh-host-apiproxy) rejects a prompt — or a model
 * switch into a session that already carries images — when the selected
 * model's `inputModalities` lack "image". That check runs BEFORE the
 * llm/stream waterfall, so the transcription wrapper above never sees the
 * request and image transcription stays dead even when configured.
 *
 * Bridge: when `ext-center.vision.enabled` is on, advertise image input on
 * the resolved model info so the request reaches the waterfall, which
 * rewrites image blocks to text before the text-only adapter reads them.
 * When the switch is off the model info passes through untouched and the
 * original rejection behavior is preserved. The wrapper is installed on
 * the llm service (restored on dispose) and only ever adds the "image"
 * modality — it never removes one.
 *
 * @param isVisionSuppressed - live dsh-web-ui gate: when the family's
 *   describe-image is ACTIVE it owns image understanding, so the bridge
 *   stays inert and the original modality check is preserved.
 */
function registerVisionCapabilityBridge(ctx, configOf, cfg, isVisionSuppressed = () => false) {
  try {
    ctx.effect(() => {
      let llm;
      try {
        llm = ctx.get("llm");
      } catch { /* the llm service is optional in this deployment */ }
      if (!llm || typeof llm.resolveModelInfo !== "function") return;
      const original = llm.resolveModelInfo;
      const patched = async function (provider, model, signal) {
        const info = await original.call(this, provider, model, signal);
        if (isVisionSuppressed()) return info;
        let vision;
        try {
          vision = visionConfigOf(configOf(), cfg);
        } catch { /* unreadable settings — keep the model info untouched */ }
        if (
          visionProfileReady(vision) &&
          !isVisionRoute({ provider, model }, vision) &&
          info && typeof info === "object" &&
          Array.isArray(info.inputModalities) &&
          !info.inputModalities.includes("image")
        ) {
          return { ...info, inputModalities: [...info.inputModalities, "image"] };
        }
        return info;
      };
      llm.resolveModelInfo = patched;
      return () => {
        if (llm.resolveModelInfo === patched) llm.resolveModelInfo = original;
      };
    }, "better-deepseek-harness: vision capability bridge");
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: vision capability bridge registration failed: %s", error?.message ?? error);
  }
}

/* ─────────────────────────── input optimization ─────────────────────────── */

/** System instruction for the one-shot input optimizer. */
const OPTIMIZE_SYSTEM_PROMPT = "You are an expert prompt optimizer for an AI coding assistant. Rewrite the user's input to be clearer, more specific, and more actionable while preserving the original intent, language, and any code or technical details. Output only the optimized text with no explanations, quotes, or formatting wrappers.";

/** One-shot optimizer output cap. */
const OPTIMIZE_MAX_TOKENS = 1024;

/** Ceiling on one optimization request's source text. */
const OPTIMIZE_TEXT_LIMIT = 100 * 1024;

/** Optimize a user draft through the currently selected model. */
async function optimizeInput(body, cx) {
  const { ctx } = cx;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw err("bad-request", "text is required");
  if (text.length > OPTIMIZE_TEXT_LIMIT) throw err("bad-request", `text exceeds ${OPTIMIZE_TEXT_LIMIT} characters`);
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const reasoningEffort = typeof body.reasoningEffort === "string" ? body.reasoningEffort.trim() : "";
  if (!provider || !model) throw err("bad-request", "current model is unavailable — select a model first");
  let llm;
  try {
    llm = ctx.get("llm");
  } catch { /* the llm service is optional in this deployment */ }
  if (!llm || typeof llm.stream !== "function") throw err("llm-unavailable", "the LLM service is not mounted");
  const request = {
    provider,
    model,
    system: OPTIMIZE_SYSTEM_PROMPT,
    maxTokens: OPTIMIZE_MAX_TOKENS,
    messages: [{
      id: randomUUID(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "user" }
    }],
    ...(typeof body.sessionId === "string" && body.sessionId.trim() !== "" ? { sessionId: body.sessionId.trim() } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {})
  };
  const stream = await llm.stream(request);
  const optimized = await collectStreamText(stream);
  if (!optimized) throw err("optimize-empty", "the model returned an empty optimization");
  return { text: optimized };
}

/* ─────────────────────────── tavily search ─────────────────────────── */

/** Cooperative tool-call budget for one tavily_search call (ms). */
const TAVILY_TOOL_TIMEOUT_MS = 30000;
/** System-prompt order: directly after the web tool guidance (tool:web_fetch is 111). */
const TAVILY_SECTION_ORDER = 112;
/** Ceiling on the stored Tavily API key (security invariant). */
const TAVILY_API_KEY_LIMIT = 4096;

/** Model guidance for when to reach for tavily_search (English, like the rest of the harness prompt). */
const TAVILY_SECTION_TEXT = "Use the tavily_search tool when you need current, real-time information (recent events, prices, news) or when you cannot answer confidently from your training data. It returns an optional summary plus source URLs; cite the relevant URLs as markdown links in your answer.";

/** Project one normalized source into a plain object without absent fields. */
function tavilySourceView(source) {
  return {
    url: source.url,
    ...(source.title !== void 0 ? { title: source.title } : {}),
    ...(source.snippet !== void 0 ? { snippet: source.snippet } : {}),
    ...(source.rawContent !== void 0 ? { rawContent: source.rawContent } : {})
  };
}

/** Pending-call presentation: a search card titled by the query. */
function presentTavilyCall(args) {
  return {
    card: "generic",
    title: args.query,
    kind: "tavily",
    rawInput: args.query
  };
}

/** Project a validated output value into its replayable presentation meta. */
function tavilyMetaFromValue(value) {
  return {
    sources: value.sources.map(tavilySourceView),
    truncated: value.truncated,
    ...(value.content !== void 0 ? { answer: value.content } : {})
  };
}

/** Completed-call presentation: a web search card carrying the structured sources. */
function presentTavilyResult(args, result) {
  if (result.isError) return void 0;
  const meta = result.meta;
  if (typeof meta !== "object" || meta === null || !Array.isArray(meta.sources) || typeof meta.truncated !== "boolean") return void 0;
  return {
    card: "web",
    kind: "search",
    title: args.query,
    sources: meta.sources,
    truncated: meta.truncated,
    ...(meta.answer !== void 0 ? { answer: meta.answer } : {})
  };
}

/**
 * The model-facing `tavily_search` tool. Execution reads the LIVE
 * ext-center.tavily settings at call time (a thunk, like the DeepSeek search
 * provider), so a settings save takes effect on the very next call without
 * re-registration. Disabled, unconfigured, or failing searches throw a clear
 * error the agent loop turns into a tool error result — the model sees the
 * message and answers from its own knowledge, so a broken search never blocks
 * a normal answer.
 */
function tavilyToolDefinition(configOf) {
  return defineTool({
    name: "tavily_search",
    description: "Search the web for current information (Tavily). Returns an optional summary answer and a list of source URLs.",
    parameters: {
      query: {
        type: "string",
        required: true,
        description: "The search query."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: { type: "string" },
          sources: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                url: { type: "string", required: true },
                title: { type: "string" },
                snippet: { type: "string" },
                rawContent: { type: "string" }
              }
            }
          },
          truncated: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatTavilyOutput(value) }],
      presentationMeta: (_args, value) => tavilyMetaFromValue(value)
    },
    timeoutMs: TAVILY_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      let settings;
      try {
        settings = resolveTavilySettings(configOf().tavily);
      } catch {
        throw new Error("Tavily settings are unreadable — check the ext-center section of settings.yaml");
      }
      if (!settings.enabled) {
        throw new Error("Tavily search is disabled (enable it in Settings → Better DeepSeek Harness → Tavily). Answer from your own knowledge.");
      }
      if (!settings.apiKey) {
        throw new Error("Tavily is enabled but no API key is configured (Settings → Better DeepSeek Harness → Tavily). Answer from your own knowledge.");
      }
      const query = String(args?.query ?? "").trim();
      if (query.length === 0) throw new Error("query must be a non-empty string");
      const signal = exec?.signal !== void 0 && typeof AbortSignal.any === "function"
        ? AbortSignal.any([exec.signal, AbortSignal.timeout(TAVILY_TOOL_TIMEOUT_MS)])
        : exec?.signal;
      let response;
      try {
        response = await fetch(TAVILY_API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept": "application/json",
            "authorization": `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify(buildTavilyRequestBody(query, settings)),
          ...(signal !== void 0 ? { signal } : {})
        });
      } catch (error) {
        if (exec?.signal?.aborted === true) throw new Error("Tavily search aborted");
        throw new Error(`Tavily search request failed: ${error?.message ?? String(error)}`);
      }
      if (!response.ok) {
        let detail = "";
        try {
          const parsed = await response.json();
          detail = typeof parsed?.error === "string" ? parsed.error : typeof parsed?.message === "string" ? parsed.message : "";
        } catch { /* non-JSON error body — keep the generic status text */ }
        const base = `Tavily API error (HTTP ${response.status})`;
        throw new Error(detail ? `${base}: ${detail}` : base);
      }
      let body;
      try {
        body = await response.json();
      } catch (error) {
        throw new Error(`Tavily returned an unprocessable response body: ${error?.message ?? String(error)}`);
      }
      const result = mapTavilyResponse(body, settings.includeRaw);
      return {
        ...(result.content !== void 0 ? { content: result.content } : {}),
        sources: result.sources.map(tavilySourceView),
        truncated: result.truncated
      };
    },
    presentCall: presentTavilyCall,
    presentResult: presentTavilyResult
  });
}

/**
 * Register the tavily_search tool and its system-prompt guidance, following
 * the live `ext-center.tavily.enabled` setting. Both registrations are
 * effect-scoped (they clean up with their fiber); each settings change
 * re-syncs the pair, so the model only ever sees the tool while the master
 * switch is on. The execution-time gate in the tool itself is the correctness
 * core — this sync is a UX refinement, never a security boundary.
 *
 * @param ctx - plugin context (`tools` is injected, `systemPrompt` is optional).
 * @param configOf - live settings reader.
 * @returns the sync function; apply() feeds it settings changes.
 */
function registerTavilySearch(ctx, configOf) {
  const state = { tool: null, section: null, promptCtx: null, promptRequested: false, disposed: false };
  const disposeTool = () => {
    if (state.tool === null) return;
    try { state.tool(); } catch { /* already gone */ }
    state.tool = null;
  };
  const disposeSection = () => {
    if (state.section === null) return;
    try { state.section(); } catch { /* already gone */ }
    state.section = null;
  };
  const disposeAll = () => {
    disposeTool();
    disposeSection();
  };
  const shutdown = () => {
    // Permanent disposal (plugin unload) only. Toggling the master switch off
    // calls disposeAll() instead, so a later re-enable can register again.
    state.disposed = true;
    disposeAll();
  };
  const ensureSection = () => {
    if (state.disposed || state.section !== null) return;
    if (state.promptCtx === null) {
      // Inject the prompt fiber once; later toggles re-register through the
      // same scoped context instead of spawning a new child fiber per toggle.
      if (state.promptRequested || typeof ctx.inject !== "function") return;
      state.promptRequested = true;
      try {
        ctx.inject(["systemPrompt"], (sctx) => {
          state.promptCtx = sctx;
          sync(configOf());
        });
      } catch (error) {
        state.promptRequested = false;
        ctx.logger?.warn?.("better-deepseek-harness: tavily_search prompt section inject failed: %s", error?.message ?? error);
      }
      return;
    }
    const sctx = state.promptCtx;
    if (!sctx || !sctx.systemPrompt || typeof sctx.systemPrompt.section !== "function") return;
    try {
      state.section = sctx.systemPrompt.section({
        name: "tool:tavily_search",
        order: TAVILY_SECTION_ORDER,
        text: TAVILY_SECTION_TEXT
      });
    } catch (error) {
      ctx.logger?.warn?.("better-deepseek-harness: tavily_search prompt section registration failed: %s", error?.message ?? error);
    }
  };
  const sync = (config) => {
    if (state.disposed) return;
    let enabled = false;
    try {
      enabled = resolveTavilySettings(config && typeof config === "object" ? config.tavily : void 0).enabled;
    } catch { /* unreadable settings — treat as disabled */ }
    if (!enabled) {
      disposeAll();
      return;
    }
    if (state.tool === null && ctx.tools && typeof ctx.tools.register === "function") {
      try {
        state.tool = ctx.tools.register(tavilyToolDefinition(configOf));
      } catch (error) {
        ctx.logger?.warn?.("better-deepseek-harness: tavily_search tool registration failed: %s", error?.message ?? error);
        state.tool = null;
      }
    }
    ensureSection();
  };
  // Both disposers are effect-scoped: unload cleans them up even when the
  // settings watch never runs again.
  if (typeof ctx.effect === "function") {
    ctx.effect(() => shutdown, "better-deepseek-harness: tavily_search registrations");
  }
  try { sync(configOf()); } catch { /* non-fatal */ }
  return sync;
}

/* ─────────────────────────── github api tools ─────────────────────────── */

/** System-prompt order: right after the tavily guidance (tool:tavily_search is 112). */
const GITHUB_SECTION_ORDER = 113;
/**
 * ToolDefinition timeout ceiling for the github_* tools. The live per-request
 * budget comes from the `ext-center.github.timeoutMs` setting at execution
 * time; this ceiling only bounds the harness-level cooperative budget.
 */
const GITHUB_TOOL_TIMEOUT_MS = GITHUB_TIMEOUT_MAX;

/** Model guidance for when to reach for the github_* tools. */
const GITHUB_SECTION_TEXT = "Use the github_repo, github_tree, github_file, github_search, and github_releases tools to query GitHub repositories through the GitHub REST API: repository metadata, directory listings, file contents, repository search, and release lists. Cite the relevant URLs as markdown links in your answer.";

/** Pending-call presentation: a generic card titled by the target resource. */
function presentGithubCall(args) {
  const target = String(args?.repo ?? args?.query ?? args?.path ?? "github");
  return { card: "generic", title: target, kind: "github", rawInput: target };
}

/** Completed-call presentation: a generic github card (the render carries the text). */
function presentGithubResult(args, result) {
  if (result.isError) return void 0;
  return { card: "generic", kind: "github", title: String(args?.repo ?? args?.query ?? args?.path ?? "github") };
}

/**
 * One GitHub REST call: reads the LIVE ext-center.github settings (gate,
 * token, timeout) at call time, fetches with the cooperative signal, and maps
 * failures to a clear model-facing error.
 */
async function githubApiCall(configOf, url, exec) {
  let settings;
  try {
    settings = resolveGithubSettings(configOf().github);
  } catch {
    throw new Error("GitHub settings are unreadable — check the ext-center section of settings.yaml");
  }
  if (!settings.enabled) {
    throw new Error("GitHub API tools are disabled (enable them in Settings → Better DeepSeek Harness → GitHub). Answer from your own knowledge.");
  }
  const signal = exec?.signal !== void 0 && typeof AbortSignal.any === "function"
    ? AbortSignal.any([exec.signal, AbortSignal.timeout(settings.timeoutMs)])
    : exec?.signal;
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: githubHeaders(settings.token),
      ...(signal !== void 0 ? { signal } : {})
    });
  } catch (error) {
    if (exec?.signal?.aborted === true) throw new Error("GitHub API call aborted");
    throw new Error(`GitHub API request failed: ${error?.message ?? String(error)}`);
  }
  let body = null;
  try {
    body = await response.json();
  } catch { /* non-JSON body — error mapping falls back to the status text */ }
  if (!response.ok) throw new Error(githubErrorMessage(response.status, body, url));
  return body ?? {};
}

/** Resolve the owner/repo arguments into a validated ref (throws on bad input). */
function githubRepoRef(args) {
  const parsed = parseRepoRef(args?.owner, args?.repo);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.ref;
}

/** The optional `ref` argument, trimmed (undefined when absent/blank). */
function githubRefArg(args) {
  return typeof args?.ref === "string" && args.ref.trim() !== "" ? args.ref.trim() : void 0;
}

/**
 * The model-facing `github_repo` tool: repository metadata through
 * `GET /repos/{owner}/{repo}`.
 */
function githubRepoToolDefinition(configOf) {
  return defineTool({
    name: "github_repo",
    description: "Fetch metadata for a GitHub repository (description, stars, forks, default branch, language, license, topics) through the GitHub REST API.",
    parameters: {
      repo: {
        type: "string",
        required: true,
        description: "Repository name, or \"owner/repo\" (e.g. \"octocat/Hello-World\")."
      },
      owner: {
        type: "string",
        description: "Repository owner (optional when repo is given as \"owner/repo\")."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          fullName: { type: "string", required: true },
          htmlUrl: { type: "string", required: true },
          description: { type: "string" },
          defaultBranch: { type: "string", required: true },
          stars: { type: "number", required: true },
          forks: { type: "number", required: true },
          openIssues: { type: "number", required: true },
          language: { type: "string" },
          license: { type: "string" },
          topics: { type: "array", required: true, items: { type: "string" } },
          pushedAt: { type: "string" },
          archived: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatGithubRepoOutput(value) }],
      presentationMeta: () => void 0
    },
    timeoutMs: GITHUB_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const ref = githubRepoRef(args);
      const body = await githubApiCall(configOf, githubRepoUrl(ref.owner, ref.repo), exec);
      return mapGithubRepoResponse(body);
    },
    presentCall: presentGithubCall,
    presentResult: presentGithubResult
  });
}

/**
 * The model-facing `github_tree` tool: directory listing through
 * `GET /repos/{owner}/{repo}/contents/{path}` (an array response). A file
 * path rejects with guidance to use github_file.
 */
function githubTreeToolDefinition(configOf) {
  return defineTool({
    name: "github_tree",
    description: "List a directory of a GitHub repository (files and subdirectories with sizes) through the GitHub REST API contents endpoint.",
    parameters: {
      repo: {
        type: "string",
        required: true,
        description: "Repository name, or \"owner/repo\" (e.g. \"octocat/Hello-World\")."
      },
      owner: {
        type: "string",
        description: "Repository owner (optional when repo is given as \"owner/repo\")."
      },
      path: {
        type: "string",
        description: "Directory path inside the repository (default: repository root)."
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA (default: the default branch)."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          entries: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string", required: true },
                path: { type: "string", required: true },
                type: { type: "string", required: true },
                size: { type: "number" },
                downloadUrl: { type: "string" }
              }
            }
          },
          truncated: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatGithubTreeOutput(value) }],
      presentationMeta: () => void 0
    },
    timeoutMs: GITHUB_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const ref = githubRepoRef(args);
      const path = String(args?.path ?? "").trim();
      const pathProblem = validateGithubPath(path);
      if (pathProblem !== null) throw new Error(pathProblem);
      const body = await githubApiCall(configOf, githubContentsUrl(ref.owner, ref.repo, path, githubRefArg(args)), exec);
      const result = mapGithubContentsResponse(body);
      if (result.kind === "file") {
        throw new Error(`"${path || "/"}" is a file, not a directory — use github_file to read it`);
      }
      return { entries: result.entries, truncated: result.truncated };
    },
    presentCall: presentGithubCall,
    presentResult: presentGithubResult
  });
}

/**
 * The model-facing `github_file` tool: file content through
 * `GET /repos/{owner}/{repo}/contents/{path}` (an object response). Base64 is
 * decoded and capped; a directory path rejects with guidance to use
 * github_tree.
 */
function githubFileToolDefinition(configOf) {
  return defineTool({
    name: "github_file",
    description: "Read a file from a GitHub repository (decoded text content, capped at 64 KiB) through the GitHub REST API contents endpoint.",
    parameters: {
      repo: {
        type: "string",
        required: true,
        description: "Repository name, or \"owner/repo\" (e.g. \"octocat/Hello-World\")."
      },
      owner: {
        type: "string",
        description: "Repository owner (optional when repo is given as \"owner/repo\")."
      },
      path: {
        type: "string",
        required: true,
        description: "File path inside the repository (e.g. \"src/index.ts\")."
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA (default: the default branch)."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: { type: "string", required: true },
          size: { type: "number", required: true },
          truncated: { type: "boolean", required: true },
          binary: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatGithubFileOutput(value) }],
      presentationMeta: () => void 0
    },
    timeoutMs: GITHUB_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const ref = githubRepoRef(args);
      const path = String(args?.path ?? "").trim();
      if (path.length === 0) throw new Error("path must be a non-empty string");
      const pathProblem = validateGithubPath(path);
      if (pathProblem !== null) throw new Error(pathProblem);
      const body = await githubApiCall(configOf, githubContentsUrl(ref.owner, ref.repo, path, githubRefArg(args)), exec);
      const result = mapGithubContentsResponse(body);
      if (result.kind === "dir") {
        throw new Error(`"${path}" is a directory, not a file — use github_tree to list it`);
      }
      return { content: result.content, size: result.size, truncated: result.truncated, binary: result.binary };
    },
    presentCall: presentGithubCall,
    presentResult: presentGithubResult
  });
}

/**
 * The model-facing `github_search` tool: repository search through
 * `GET /search/repositories`.
 */
function githubSearchToolDefinition(configOf) {
  return defineTool({
    name: "github_search",
    description: "Search GitHub repositories by query (name, description, readme, language, stars, topics) through the GitHub REST API.",
    parameters: {
      query: {
        type: "string",
        required: true,
        description: "The search query (GitHub search syntax, e.g. \"topic:rust stars:>1000\")."
      },
      limit: {
        type: "number",
        description: `Max results, 1-${GITHUB_SEARCH_CAP} (default 5).`
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          totalCount: { type: "number", required: true },
          items: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                fullName: { type: "string", required: true },
                htmlUrl: { type: "string", required: true },
                description: { type: "string" },
                language: { type: "string" },
                stars: { type: "number", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatGithubSearchOutput(value) }],
      presentationMeta: () => void 0
    },
    timeoutMs: GITHUB_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const query = String(args?.query ?? "").trim();
      if (query.length === 0) throw new Error("query must be a non-empty string");
      if (query.length > 256) throw new Error("query is too long (max 256 chars)");
      let limit = 5;
      if (args?.limit !== void 0) {
        const candidate = Number(args.limit);
        if (!Number.isInteger(candidate) || candidate < 1 || candidate > GITHUB_SEARCH_CAP) {
          throw new Error(`limit must be an integer between 1 and ${GITHUB_SEARCH_CAP}`);
        }
        limit = candidate;
      }
      const body = await githubApiCall(configOf, githubSearchUrl(query, limit), exec);
      return mapGithubSearchResponse(body, limit);
    },
    presentCall: presentGithubCall,
    presentResult: presentGithubResult
  });
}

/**
 * The model-facing `github_releases` tool: recent releases through
 * `GET /repos/{owner}/{repo}/releases`.
 */
function githubReleasesToolDefinition(configOf) {
  return defineTool({
    name: "github_releases",
    description: "List the recent releases of a GitHub repository (tag, name, publish date, release notes) through the GitHub REST API.",
    parameters: {
      repo: {
        type: "string",
        required: true,
        description: "Repository name, or \"owner/repo\" (e.g. \"octocat/Hello-World\")."
      },
      owner: {
        type: "string",
        description: "Repository owner (optional when repo is given as \"owner/repo\")."
      },
      limit: {
        type: "number",
        description: `Max releases, 1-${GITHUB_RELEASES_CAP} (default 5).`
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          releases: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                tagName: { type: "string", required: true },
                htmlUrl: { type: "string", required: true },
                name: { type: "string" },
                publishedAt: { type: "string" },
                body: { type: "string" }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatGithubReleasesOutput(value) }],
      presentationMeta: () => void 0
    },
    timeoutMs: GITHUB_TOOL_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const ref = githubRepoRef(args);
      let limit = 5;
      if (args?.limit !== void 0) {
        const candidate = Number(args.limit);
        if (!Number.isInteger(candidate) || candidate < 1 || candidate > GITHUB_RELEASES_CAP) {
          throw new Error(`limit must be an integer between 1 and ${GITHUB_RELEASES_CAP}`);
        }
        limit = candidate;
      }
      const body = await githubApiCall(configOf, githubReleasesUrl(ref.owner, ref.repo, limit), exec);
      return mapGithubReleasesResponse(body, limit, GITHUB_RELEASE_BODY_CAP);
    },
    presentCall: presentGithubCall,
    presentResult: presentGithubResult
  });
}

/**
 * Register the five github_* tools and their system-prompt guidance,
 * following the live `ext-center.github.enabled` setting. Same lifecycle as
 * the Tavily pair: effect-scoped disposal, settings-watch re-sync, and the
 * execution-time gate as the correctness core (the sync is a UX refinement,
 * never a security boundary).
 *
 * @param ctx - plugin context (`tools` is injected, `systemPrompt` is optional).
 * @param configOf - live settings reader.
 * @returns the sync function; apply() feeds it settings changes.
 */
function registerGithubTools(ctx, configOf) {
  const definitions = [
    githubRepoToolDefinition,
    githubTreeToolDefinition,
    githubFileToolDefinition,
    githubSearchToolDefinition,
    githubReleasesToolDefinition
  ];
  const state = { tools: [], section: null, promptCtx: null, promptRequested: false, disposed: false };
  const disposeTools = () => {
    for (const dispose of state.tools.splice(0)) {
      try { dispose(); } catch { /* already gone */ }
    }
  };
  const disposeSection = () => {
    if (state.section === null) return;
    try { state.section(); } catch { /* already gone */ }
    state.section = null;
  };
  const disposeAll = () => {
    disposeTools();
    disposeSection();
  };
  const shutdown = () => {
    // Permanent disposal (plugin unload) only. Toggling the master switch off
    // calls disposeAll() instead, so a later re-enable can register again.
    state.disposed = true;
    disposeAll();
  };
  const ensureSection = () => {
    if (state.disposed || state.section !== null) return;
    if (state.promptCtx === null) {
      // Inject the prompt fiber once; later toggles re-register through the
      // same scoped context instead of spawning a new child fiber per toggle.
      if (state.promptRequested || typeof ctx.inject !== "function") return;
      state.promptRequested = true;
      try {
        ctx.inject(["systemPrompt"], (sctx) => {
          state.promptCtx = sctx;
          sync(configOf());
        });
      } catch (error) {
        state.promptRequested = false;
        ctx.logger?.warn?.("better-deepseek-harness: github prompt section inject failed: %s", error?.message ?? error);
      }
      return;
    }
    const sctx = state.promptCtx;
    if (!sctx || !sctx.systemPrompt || typeof sctx.systemPrompt.section !== "function") return;
    try {
      state.section = sctx.systemPrompt.section({
        name: "tool:github",
        order: GITHUB_SECTION_ORDER,
        text: GITHUB_SECTION_TEXT
      });
    } catch (error) {
      ctx.logger?.warn?.("better-deepseek-harness: github prompt section registration failed: %s", error?.message ?? error);
    }
  };
  const sync = (config) => {
    if (state.disposed) return;
    let enabled = false;
    try {
      enabled = resolveGithubSettings(config && typeof config === "object" ? config.github : void 0).enabled;
    } catch { /* unreadable settings — treat as disabled */ }
    if (!enabled) {
      disposeAll();
      return;
    }
    if (state.tools.length === 0 && ctx.tools && typeof ctx.tools.register === "function") {
      try {
        for (const make of definitions) {
          state.tools.push(ctx.tools.register(make(configOf)));
        }
      } catch (error) {
        ctx.logger?.warn?.("better-deepseek-harness: github tool registration failed: %s", error?.message ?? error);
        disposeTools();
      }
    }
    ensureSection();
  };
  // Both disposers are effect-scoped: unload cleans them up even when the
  // settings watch never runs again.
  if (typeof ctx.effect === "function") {
    ctx.effect(() => shutdown, "better-deepseek-harness: github tool registrations");
  }
  try { sync(configOf()); } catch { /* non-fatal */ }
  return sync;
}

/* ─────────────────────────── rescue mode ─────────────────────────── */

/**
 * Rescue mode: when a previous boot never settled (crashed at startup), or
 * startup problems are detected live (failed third-party fibers, duplicate
 * loader entry ids), every third-party plugin except this one is disabled in
 * the profile patch — the boot HMR watcher hot-applies it, so the running
 * tree becomes the minimal configuration and every later boot composes it
 * from the file. The Web UI then shows a dialog over the disabled list and
 * the user decides what to re-enable.
 *
 * The "restart" contract: the desktop host (DSH_DESKTOP=1) treats an
 * unexpected host exit as fatal for the whole app, so rescue never kills the
 * process there — the hot reapply IS the minimal-config restart, and the
 * user-confirmed re-enable reloads the page. A bare `dsh web` host has no
 * supervisor, so the confirmed re-enable respawns the process with the same
 * argv (a true full reload).
 *
 * Everything here is exception-safe: rescue bookkeeping must never fail the
 * plugin load (a failure here would fail the boot audit and defeat the
 * feature entirely).
 */

/** Injectable seams for tests: restart scheduling, pid, desktop detection. */
const rescueHostHooks = { scheduleRestart: null, pid: null, isDesktop: null };

/**
 * Test-only hook (like the installation-pipeline exports): override the host
 * side effects rescue mode performs. `scheduleRestart` replaces the process
 * respawn, `pid` replaces process.pid, `isDesktop` replaces the DSH_DESKTOP
 * check.
 */
function __setRescueHostHooks(hooks) {
  if (hooks && typeof hooks === "object") {
    if (hooks.scheduleRestart !== void 0) rescueHostHooks.scheduleRestart = hooks.scheduleRestart;
    if (hooks.pid !== void 0) rescueHostHooks.pid = hooks.pid;
    if (hooks.isDesktop !== void 0) rescueHostHooks.isDesktop = hooks.isDesktop;
  }
}

function rescuePid() {
  return rescueHostHooks.pid !== null ? rescueHostHooks.pid : process.pid;
}

function isDesktopHost() {
  return rescueHostHooks.isDesktop !== null ? rescueHostHooks.isDesktop : process.env.DSH_DESKTOP === "1";
}

/** The settle timers of the current plugin instance (cleared on dispose). */
const rescueTimers = new Set();

function loadRescueState(layout) {
  try {
    return sanitizeRescueState(JSON.parse(readFileSync(layout.rescueFile, "utf8")));
  } catch { /* absent or malformed — start fresh */
    return emptyRescueState(Date.now());
  }
}

function saveRescueState(layout, state) {
  try {
    const tmp = layout.rescueFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
    renameSync(tmp, layout.rescueFile);
    return true;
  } catch { /* rescue bookkeeping is best-effort */
    return false;
  }
}

/** Live loader entries as the pure rescue logic sees them. */
function liveEntriesOf(ctx) {
  const views = new Map();
  let loader;
  try {
    loader = ctx.get("loader");
  } catch { /* loader inspection is best-effort */ }
  if (loader && typeof loader.entries === "function") {
    for (const entry of loader.entries()) {
      if (entry.options?.group) continue;
      views.set(String(entry.id), {
        id: String(entry.id),
        name: String(entry.options?.name ?? ""),
        disabled: entry.disabled === true,
        group: entry.options?.group === true,
        fiberState: entry.fiber ? entry.fiber.state : void 0
      });
    }
  }
  return views;
}

/* ─────────────────────── dsh-web-ui compatibility gate ─────────────────────── */

/**
 * dsh-web-ui compatibility gate (host half).
 *
 * The dsh-web-ui family (https://github.com/zhu1090093659/dsh-web-ui) owns
 * the same elements this plugin offers — aionui-panel owns the file tree and
 * the git surface, dsh-ssh owns the web terminal, describe-image owns image
 * understanding. When one of those plugins is ACTIVE in the same profile,
 * this plugin stands down the corresponding surface so the two never fight
 * over one element; dsh-web-ui keeps the feature.
 *
 * The snapshot is taken at apply() time and refreshed once the loader tree
 * settles — a sibling bundle may still be pending when this plugin's apply()
 * runs. Decisions are read per request/registration call, so a late settle
 * refresh takes effect without re-registering anything. A missing loader
 * (unit mocks, minimal deployments) leaves the snapshot empty: fail-open,
 * this plugin keeps its surfaces.
 */
function createDshWebUiGate(ctx, timeoutMs = 8000) {
  const presence = emptyDshWebUiPresence();
  const refresh = () => {
    try {
      const detected = detectDshWebUi(liveEntriesOf(ctx).values());
      presence.aionuiPanel = detected.aionuiPanel;
      presence.gitGraph = detected.gitGraph;
      presence.ssh = detected.ssh;
      presence.describeImage = detected.describeImage;
    } catch { /* the previous snapshot stays authoritative */ }
  };
  const suppressed = (surface) => dshWebUiSuppression(presence)[surface];
  refresh();
  waitForLoaderSettled(ctx, timeoutMs)
    .then(refresh)
    .catch(() => { /* the initial snapshot stays authoritative */ });
  return { suppressed };
}

/** The live loader entry for one id (for failed-fiber reason enrichment). */
function liveLoaderEntry(ctx, entryId) {
  try {
    const loader = ctx.get("loader");
    if (loader && typeof loader.resolve === "function") return loader.resolve(entryId);
  } catch { /* best-effort */ }
  return void 0;
}

/** Best-effort capture of a failed fiber's rejection message. */
async function fiberFailureMessage(ctx, entryId) {
  try {
    const entry = liveLoaderEntry(ctx, entryId);
    if (!entry?.fiber || entry.fiber.state !== 3) return "";
    const reason = await Promise.race([
      entry.fiber.await().then(() => null, (error) => error),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000))
    ]);
    return reason instanceof Error ? reason.message : "";
  } catch { /* best-effort */
    return "";
  }
}

/** Resolve one bundle package directory from the profile's own resolution. */
function bundleDirFromProfile(layout, packageName) {
  try {
    const require = createRequire(layout.manifestFile);
    for (const searchPath of require.resolve.paths(packageName) ?? []) {
      const candidate = join(searchPath, packageName);
      if (existsSync(join(candidate, "package.json"))) return candidate;
    }
  } catch { /* unresolvable — not a profile dependency */ }
  return null;
}

/**
 * Resolve the third-party profile bundle layers (dsh.profile.bundles entries
 * that are not harness core): their loader row ids come from each bundle's
 * own `dsh.bundle.patch` file, so rescue can disable them with id-targeted
 * patch rows. Unresolvable bundles are skipped (a plain dependency or an
 * install problem — the patch layer cannot target it anyway).
 *
 * Returns `{ layers, protect }`: `protect` names the bundle layers rescue
 * must never disable — every name in `extraProtect`, plus the host's own
 * front door when it can be identified: in a host WITHOUT a webServer
 * service (headless/TUI deployment), a third-party bundle that mounts itself
 * as a loader row (an insert entry whose `name` is its own package name) IS
 * the interactive surface — disabling it would kill the only place the user
 * can restore from. Web hosts always have a webServer front door (harness
 * core), so no third-party bundle is auto-protected there.
 */
function thirdPartyBundleLayers(layout, ctx, ownName, extraProtect = []) {
  const manifest = profileManifest(layout);
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [];
  const layers = [];
  const protect = new Set(extraProtect);
  let headless = true;
  try {
    headless = ctx.get("webServer") === undefined;
  } catch { /* no webServer service — headless host */ }
  for (const name of bundles) {
    if (typeof name !== "string" || name === ownName || name.startsWith("@deepseek-ai/") || name.startsWith("cordis:")) continue;
    const dir = bundleDirFromProfile(layout, name);
    if (!dir) {
      ctx.logger?.warn?.("better-deepseek-harness: rescue cannot resolve profile bundle %s — skipped", name);
      continue;
    }
    let declared;
    try {
      declared = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))?.dsh?.bundle?.patch;
    } catch { /* unreadable manifest */ }
    if (typeof declared !== "string" || declared === "") continue;
    const patchPath = resolve(dir, declared);
    if (!existsSync(patchPath)) continue;
    let rows;
    try {
      rows = loadPatchList({ patchFile: patchPath });
    } catch (error) {
      ctx.logger?.warn?.("better-deepseek-harness: rescue cannot read bundle patch %s: %s", patchPath, error?.message ?? error);
      continue;
    }
    const rowIds = [];
    const inserts = [];
    for (const row of rows) {
      rowIds.push(...patchRowIds(row));
      if (Array.isArray(row.insert)) inserts.push(...row.insert);
    }
    if (rowIds.length > 0) {
      layers.push({ name, rowIds });
      const selfMounted = inserts.some((entry) => entry !== null && typeof entry === "object"
        && !Array.isArray(entry) && String((entry).name) === name);
      if (headless && selfMounted) {
        ctx.logger?.info?.("better-deepseek-harness: rescue protects %s — it is the front door of this headless/TUI host", name);
        protect.add(name);
      }
    }
  }
  return { layers, protect };
}

function loadPatchListSafe(layout) {
  try {
    return loadPatchList(layout);
  } catch { /* unreadable patch — treat as empty for detection */
    return [];
  }
}

/**
 * Apply rescue mode right now (synchronous — the patch write must land before
 * the boot audit can kill the process; exception-safe — nothing here may fail
 * the plugin load). Returns the outcome verdict for the API surface.
 */
function applyRescue(cx, failure) {
  const { layout, ctx } = cx;
  const now = Date.now();
  const boot = { pid: rescuePid(), startedAt: now, healthy: false, healthyAt: null };
  const log = (message, ...args) => ctx.logger?.warn?.(message, ...args);

  const state = loadRescueState(layout);
  if (state.phase === "applied") return { applied: false, reason: "already-applied" };
  let list;
  try {
    list = loadPatchList(layout);
  } catch (error) {
    log("better-deepseek-harness: rescue apply skipped — patch list unreadable: %s", error?.message ?? error);
    return { applied: false, reason: "patch-unreadable" };
  }
  const { layers, protect } = thirdPartyBundleLayers(layout, ctx, NAME, cx.cfg.rescue.protectBundles);
  const plan = buildRescuePlan(list, layers, NAME, liveEntriesOf(ctx), failure, protect);
  if (!plan.changed) {
    log("better-deepseek-harness: rescue mode has no third-party plugins to disable — staying in normal mode");
    saveRescueState(layout, withBoot(state, boot.pid, now));
    scheduleRescueSettle(cx, boot);
    return { applied: false, reason: "nothing-to-disable" };
  }
  try {
    const raw = readPatchRaw(layout);
    savePatchList(layout, plan.updatedList, raw);
  } catch (error) {
    log("better-deepseek-harness: rescue patch write failed: %s", error?.message ?? error);
    return { applied: false, reason: "patch-write-failed" };
  }
  const appliedState = {
    version: RESCUE_STATE_VERSION,
    phase: "applied",
    failure,
    plugins: plan.plugins,
    appliedAt: new Date().toISOString(),
    boot
  };
  saveRescueState(layout, appliedState);
  log(
    "better-deepseek-harness: rescue mode applied (%s) — disabled %d third-party plugin(s): %s",
    failure.kind,
    plan.plugins.length,
    plan.plugins.map((plugin) => plugin.name).join(", ")
  );
  scheduleRescueSettle(cx, boot);
  return { applied: true, count: plan.plugins.length };
}

/**
 * The one-shot settle check: after the startup window, either declare the
 * boot healthy (no problems) or apply rescue (a late startup failure).
 */
function scheduleRescueSettle(cx, boot) {
  const { layout, ctx } = cx;
  const timer = setTimeout(() => {
    rescueTimers.delete(timer);
    const state = loadRescueState(layout);
    if (state.boot.pid !== boot.pid || state.boot.startedAt !== boot.startedAt) return; // a newer boot record took over
    const { layers, protect } = thirdPartyBundleLayers(layout, ctx, NAME, cx.cfg.rescue.protectBundles);
    const problems = startupProblems(loadPatchListSafe(layout), liveEntriesOf(ctx), NAME, {
      includePending: true,
      extraIds: layers.filter((layer) => !protect.has(layer.name)).flatMap((layer) => layer.rowIds)
    });
    if (problems.length > 0) {
      applyRescue(cx, problems[0]);
      return;
    }
    saveRescueState(layout, markBootHealthy(state, Date.now()));
  }, cx.cfg.rescue.settleMs);
  rescueTimers.add(timer);
}

/**
 * The boot watchdog: record this boot, and either apply rescue (previous boot
 * crashed, or startup problems are already visible) or start the settle
 * window. Runs first in apply() so the synchronous patch write wins the race
 * against the boot audit. Skipped entirely when the profile has no patch
 * layer (nothing to rescue; also keeps test fixtures inert).
 */
function runRescueWatchdog(cx) {
  const { layout, ctx } = cx;
  try {
    if (!cx.cfg.rescue.enabled) return;
    if (!existsSync(layout.patchFile)) return;
    const state = loadRescueState(layout);
    const boot = { pid: rescuePid(), startedAt: Date.now(), healthy: false, healthyAt: null };
    if (state.phase === "applied") {
      // The minimal config is already persisted; this boot rides it. Keep the
      // applied record so the dialog shows, and settle this boot normally.
      saveRescueState(layout, { ...state, boot });
      scheduleRescueSettle(cx, boot);
      return;
    }
    if (previousBootFailed(state)) {
      applyRescue(cx, {
        kind: "crash",
        message: "the previous DeepSeek Harness boot did not complete — a plugin conflict or a failed third-party plugin is the likely cause"
      });
      return;
    }
    const { layers, protect } = thirdPartyBundleLayers(layout, ctx, NAME, cx.cfg.rescue.protectBundles);
    const problems = startupProblems(loadPatchListSafe(layout), liveEntriesOf(ctx), NAME, {
      includePending: false,
      extraIds: layers.filter((layer) => !protect.has(layer.name)).flatMap((layer) => layer.rowIds)
    });
    if (problems.length > 0) {
      applyRescue(cx, problems[0]);
      return;
    }
    saveRescueState(layout, { ...state, boot });
    scheduleRescueSettle(cx, boot);
  } catch (error) {
    // The watchdog must never fail the plugin load.
    ctx.logger?.warn?.("better-deepseek-harness: rescue watchdog failed: %s", error?.message ?? error);
  }
}

/** The status payload for /ext/api/rescue/status (enriched with live fiber errors). */
async function rescueStatusOf(cx) {
  const { layout, ctx } = cx;
  const state = loadRescueState(layout);
  const view = rescueStatusView(state);
  if (state.phase === "applied") {
    for (const plugin of view.plugins) {
      if (plugin.kind !== "patch" || plugin.reason.code !== "load-failed") continue;
      const detail = await fiberFailureMessage(ctx, plugin.id);
      if (detail !== "") plugin.reason = { ...plugin.reason, detail };
    }
  }
  return view;
}

/** Respawn the host with the same argv (bare `dsh web` mode has no supervisor). */
function defaultScheduleRestart() {
  setTimeout(() => {
    try {
      const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: { ...process.env }
      });
      child.unref();
    } catch (error) {
      process.stderr.write(`better-deepseek-harness: failed to respawn the host: ${error?.message ?? error}\n`);
    }
    process.exit(0);
  }, 400);
}

let restartScheduled = false;

/** Schedule the one-shot process respawn (called only by the resolve route). */
function scheduleHostRestart() {
  if (restartScheduled) return;
  restartScheduled = true;
  const schedule = rescueHostHooks.scheduleRestart ?? defaultScheduleRestart;
  schedule();
}

/** The user's confirmation: apply the re-enable selection and reload. */
async function resolveRescue(body, cx) {
  const { layout, ctx } = cx;
  const rawEnable = Array.isArray(body.enable) ? body.enable : [];
  const enable = [...new Set(rawEnable
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name !== ""))];
  if (enable.length > 256) throw err("bad-request", "enable must contain at most 256 plugin names");
  const state = loadRescueState(layout);
  if (state.phase !== "applied") throw err("rescue-inactive", "rescue mode is not active");
  // withPatchWrite serializes the mutator against concurrent API writes and
  // persists the SAME list object it hands over, so the plan's replacement
  // list is spliced back in place.
  const { restored } = await withPatchWrite(layout, (list) => {
    const plan = buildRestorePlan(list, state, enable);
    list.splice(0, list.length, ...plan.updatedList);
    return plan;
  });
  const now = Date.now();
  // The dialog's decision ends the rescue cycle: the current boot demonstrably
  // started (it shows the dialog), so it is recorded as settled — a restart
  // right after must not re-trigger rescue, while a genuinely failing next
  // boot still leaves its own un-settled marker.
  saveRescueState(layout, {
    version: RESCUE_STATE_VERSION,
    phase: "idle",
    failure: null,
    plugins: [],
    appliedAt: null,
    boot: { pid: rescuePid(), startedAt: now, healthy: true, healthyAt: now }
  });
  ctx.logger?.info?.(
    "better-deepseek-harness: rescue resolved — re-enabled %d plugin(s), %d stay disabled",
    restored.length,
    state.plugins.length - restored.length
  );
  if (enable.length === 0) return { restored, reload: "none" };
  if (isDesktopHost()) return { restored, reload: "page" };
  scheduleHostRestart();
  return { restored, reload: "process" };
}

/* ─────────────────────── rescue command surface (headless/TUI) ─────────────────────── */

/** Status text for the /rescue command (the Web dialog's polling payload, rendered as lines). */
function rescueStatusText(view) {
  const lines = [];
  if (!view.active) {
    lines.push("急救模式未生效（phase: idle）");
    return lines.join("\n");
  }
  lines.push("急救模式已生效：");
  if (view.failure) lines.push(`触发原因: ${view.failure.kind} — ${view.failure.message}`);
  lines.push(`被禁用插件 (${view.plugins.length}):`);
  for (const plugin of view.plugins) {
    const detail = plugin.reason.detail ? ` — ${plugin.reason.detail}` : "";
    lines.push(`  - ${plugin.name}（${plugin.reason.code}）${detail}`);
  }
  lines.push("恢复: /rescue apply all | /rescue apply none | /rescue apply <插件名,...>");
  return lines.join("\n");
}

/** The `/rescue apply` subcommand: restore the named plugins (all / none / explicit names). */
async function applyRescueCommandText(cx, names) {
  const state = loadRescueState(cx.layout);
  const all = state.plugins.map((plugin) => plugin.name);
  const enable = names.length === 0 ? [] : names.includes("all") ? all : names;
  const outcome = await resolveRescue({ enable }, cx);
  const lines = [
    `已恢复 ${outcome.restored.length} 个插件：${outcome.restored.join(", ") || "（无）"}`,
    `其余 ${state.plugins.length - outcome.restored.length} 个保持禁用`,
    outcome.reload === "none"
      ? "未触发重载（选择保持禁用的插件不会重启）"
      : outcome.reload === "page"
        ? "页面将刷新"
        : "宿主进程将重启"
  ];
  return lines.join("\n");
}

/**
 * The `/rescue` slash command: the non-GUI interaction surface for rescue
 * mode. The dsh-TUI slash menu merges registry commands and dispatches them
 * here; the Web UI keeps using the dialog + /ext/api polling. Subcommands:
 *
 *   /rescue                    — status (phase, failure, disabled plugins)
 *   /rescue status             — same
 *   /rescue apply all          — re-enable every disabled plugin
 *   /rescue apply none         — keep everything disabled, end the cycle
 *   /rescue apply <names>      — re-enable the named plugins (comma/space separated)
 *   /rescue trigger            — manually enter rescue mode (disables third-party plugins)
 *
 * Returns false when no command registry is mounted (the Web host still has
 * one from dsh-base, so the command exists there too — harmless).
 */
function registerRescueCommands(ctx, cx) {
  let commands;
  try { commands = ctx.get("commands"); } catch { /* the command registry is optional */ }
  if (!commands || typeof commands.register !== "function") return false;
  ctx.effect(() => commands.register({
    name: "rescue",
    description: "Rescue mode: show status, restore plugins, or trigger manually",
    input: { hint: "status | apply all|none|<names> | trigger" },
    handler: async (invocation) => {
      const raw = String(invocation?.rawInput ?? "").trim();
      const parts = raw.split(/\s+/).filter((part) => part !== "");
      const verb = parts[0] ?? "";
      try {
        if (verb === "apply") {
          const names = parts.slice(1).join(",").split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "");
          return { kind: "success", text: await applyRescueCommandText(cx, names) };
        }
        if (verb === "trigger") {
          const outcome = applyRescue(cx, {
            kind: "manual",
            message: "rescue mode was requested manually via the /rescue command"
          });
          const view = await rescueStatusOf(cx);
          const head = outcome.applied
            ? `已进入急救模式：禁用了 ${outcome.count} 个第三方插件`
            : `急救未触发（${outcome.reason ?? "unknown"}）`;
          return { kind: "success", text: `${head}\n${rescueStatusText(view)}` };
        }
        return { kind: "success", text: rescueStatusText(await rescueStatusOf(cx)) };
      } catch (error) {
        return { kind: "error", text: error?.message ?? String(error) };
      }
    }
  }), "better-deepseek-harness: /rescue command");
  ctx.logger?.info?.("better-deepseek-harness: /rescue command registered (non-GUI rescue surface)");
  return true;
}

/* ─────────────────────────── the plugin ─────────────────────────── */

const inject = ["tools"];

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

  // 0. rescue-mode watchdog — runs FIRST so the synchronous patch write (when
  //    a previous boot crashed or startup problems are visible) lands before
  //    the boot audit can kill the process.
  runRescueWatchdog(cx);

  // 0a. tool-call argument repair
  registerToolRepair(ctx, cfg);

  // 0b+0c. image transcription + vision capability bridge. Both stay inert
  //     while the dsh-web-ui family's describe-image is ACTIVE — it owns
  //     image understanding in that deployment (its send hook rewrites image
  //     sends client-side, so our transcription would never see image blocks).
  const dshWebUiGate = createDshWebUiGate(ctx);
  registerVisionListener(ctx, configOf, cfg, () => dshWebUiGate.suppressed("vision"));
  registerVisionCapabilityBridge(ctx, configOf, cfg, () => dshWebUiGate.suppressed("vision"));

  // 0d. Tavily search: the model-facing tavily_search tool plus its prompt
  //     guidance, following the live ext-center.tavily.enabled setting.
  const syncTavily = registerTavilySearch(ctx, configOf);

  // 0e. GitHub REST API: the github_repo/tree/file/search/releases tools plus
  //     their prompt guidance, following the live ext-center.github.enabled
  //     setting (public repositories need no token, so they default on).
  const syncGithub = registerGithubTools(ctx, configOf);

  // 1. settings namespace (native preferences). The registration rides a
  //    scoped fiber that waits for the settings service (the same pattern as
  //    dsh-settings' installSettingsSection): ctx.get("settings") at
  //    apply() time returns undefined while the provider is still starting,
  //    and a one-shot read would silently lose the namespace forever — the
  //    settings tab would stay "loading" with no config fields at all.
  try {
    ctx.inject(["settings"], (sctx) => {
      const owner = sctx?.settings?.register?.(SETTINGS_NS, SettingsSchema, { base: DEFAULTS });
      if (owner && typeof owner.watch === "function") {
        try {
          owner.watch((next) => {
            try { syncTavily(next); } catch { /* non-fatal */ }
            try { syncGithub(next); } catch { /* non-fatal */ }
          });
        } catch { /* watcher registration is best-effort */ }
      }
      // The settings service may already be up when apply() ran the initial
      // sync — refresh once now that the namespace is authoritative.
      try { syncTavily(configOf()); } catch { /* non-fatal */ }
      try { syncGithub(configOf()); } catch { /* non-fatal */ }
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

  // 3a. rescue command surface for non-GUI hosts (the dsh-TUI slash menu merges
  //     registry commands; the Web UI keeps using the dialog + /ext/api).
  try {
    registerRescueCommands(ctx, cx);
  } catch (error) {
    ctx.logger?.warn?.("better-deepseek-harness: /rescue command registration failed: %s", error?.message ?? error);
  }
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
    const route = Object.hasOwn(routes, pathname) ? routes[pathname] : void 0;
    if (!route) return send(res, 404, { ok: false, error: { code: "not-found", message: pathname } });
    if (route.method !== req.method) return send(res, 405, { ok: false, error: { code: "method-not-allowed", message: req.method } });
    if ((route.mutating || route.requiresLocal) && !isLoopback(req) && !configOf().allowLan) {
      const message = route.requiresLocal
        ? "this endpoint is loopback-only unless ext-center.allowLan is enabled"
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
      const message = error?.message ?? String(error);
      ctx.logger?.warn?.("better-deepseek-harness: %s failed: %s", pathname, message);
      outcome = { ok: false, error: { code: error?.code || "internal", message } };
    }
    send(res, 200, outcome);
  };
  // The webServer service is optional: GUI hosts mount it, while headless/TUI
  // hosts (e.g. dsh-TUI) have no web layer — every host-side feature (rescue
  // watchdog, settings, skills, Tavily, tool repair, image transcription)
  // keeps working there, and the /rescue command becomes the interaction
  // surface instead of the Web dialog.
  let webServer;
  try { webServer = ctx.get("webServer"); } catch { /* not mounted */ }
  if (webServer && typeof webServer.register === "function") {
    ctx.effect(() => webServer.register({ kind: "prefix", path: "/ext/api", handler: handle }), "better-deepseek-harness: api routes");
    ctx.logger?.info?.("better-deepseek-harness: API mounted at /ext/api (profile %s)", layout.profileDir);
  } else {
    ctx.logger?.info?.("better-deepseek-harness: API not mounted — no webServer service in this host (headless/TUI deployment); host-side features stay active");
  }

  // 4. terminal lifecycle: kill every pty child when the plugin is disposed
  ctx.effect(() => {
    return () => {
      for (const session of terminalSessions.values()) {
        try { session.impl.kill(); } catch { /* already gone */ }
      }
      terminalSessions.clear();
    };
  }, "better-deepseek-harness: terminals");

  // 5. rescue settle timers: a pending settle check must not fire after unload
  ctx.effect(() => {
    return () => {
      for (const timer of rescueTimers) clearTimeout(timer);
      rescueTimers.clear();
    };
  }, "better-deepseek-harness: rescue settle timers");
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
function resolveTreeRoot(ctx, configOf, sessionId) {
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
function listTreeDir(_body, cx, query) {
  const { ctx, configOf, cfg } = cx;
  const root = resolveTreeRoot(ctx, configOf);
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
    // Dirent.isDirectory() does not follow symlinks, so a link to an outside
    // directory surfaces as a plain file (and its target is still rejected by
    // resolveTreePath on read) instead of leaking the outside directory tree.
    const isDir = entry.isDirectory();
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
function readTreeFile(_body, cx, query) {
  const { ctx, configOf } = cx;
  const root = resolveTreeRoot(ctx, configOf);
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
  const { ctx, configOf } = cx;
  const requested = typeof body.path === "string" ? body.path.trim() : "";
  if (!requested) throw err("bad-request", "path is required");
  if (typeof body.content !== "string") throw err("bad-request", "content must be a string");
  const root = resolveTreeRoot(ctx, configOf);
  const file = resolveTreePath(root, requested);
  let stat;
  try {
    stat = lstatSync(file);
  } catch (error) {
    throw err("tree-read", "cannot stat " + file + ": " + error.message);
  }
  if (stat.isSymbolicLink()) throw err("tree-symlink", "refusing to replace a symlink: " + file);
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

/* ─────────────────────────── archived sessions ─────────────────────────── */

/** The workspace registry's current archive set, or [] when unavailable. */
function archivedSessionIdsOf(ctx) {
  let registry;
  try {
    registry = ctx.get("workspaceRegistry");
  } catch { /* the workspace registry is optional in this deployment */ }
  if (!registry || !Array.isArray(registry.archivedSessionIds)) return [];
  return registry.archivedSessionIds;
}

/** Permanently remove one archived session's durable log directory. */
function removeArchivedSessionLog(persistence, header) {
  const loc = persistence.locate(header);
  if (!loc || typeof loc.path !== "string" || loc.path.length === 0) {
    throw err("archive-locate", "cannot locate the stored log for session " + header.id);
  }
  // The JSONL backend owns one directory per session; deleting it removes the
  // transcript plus any session-owned artifacts (the session is archived, so
  // no grouping surface shows it once the log is gone).
  rmSync(dirname(loc.path), { recursive: true, force: true });
}

/**
 * Delete archived conversations. Only sessions currently in the registry's
 * archive set and not live (attached) may be deleted; their durable logs are
 * removed and workspace accounting slots are detached.
 */
async function deleteArchivedSessions(body, cx) {
  const { ctx } = cx;
  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = [...new Set(rawIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id !== ""))];
  if (ids.length === 0) throw err("bad-request", "ids must be a non-empty array");
  if (ids.length > ARCHIVE_BATCH_MAX) throw err("bad-request", `ids must contain at most ${ARCHIVE_BATCH_MAX} entries`);
  const archived = new Set(archivedSessionIdsOf(ctx));
  const notArchived = ids.filter((id) => !archived.has(id));
  if (notArchived.length > 0) throw err("archive-not-found", "not archived: " + notArchived.join(", "));

  let persistence;
  try {
    persistence = ctx.get("sessionPersistence");
  } catch { /* the session persistence service is optional in this deployment */ }
  if (!persistence || typeof persistence.list !== "function" || typeof persistence.locate !== "function") {
    throw err("archive-unavailable", "session persistence is not mounted");
  }
  const headers = await persistence.list();
  const byId = new Map(headers.map((header) => [header.id, header]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) throw err("archive-missing", "no stored log for: " + missing.join(", "));

  let sessions;
  try {
    sessions = ctx.get("sessions");
  } catch { /* the live session store is optional in this deployment */ }
  const live = ids.filter((id) => (sessions && typeof sessions.get === "function" ? sessions.get(id) : false));
  const liveSet = new Set(live);
  const deletable = ids.filter((id) => !liveSet.has(id));
  if (deletable.length === 0) return { deleted: [], skipped: live, count: 0 };

  for (const id of deletable) removeArchivedSessionLog(persistence, byId.get(id));

  let registry;
  try {
    registry = ctx.get("workspaceRegistry");
  } catch { /* the workspace registry is optional in this deployment */ }
  if (registry && typeof registry.list === "function") {
    const deletedSet = new Set(deletable);
    for (const workspace of registry.list()) {
      if (!workspace || typeof workspace.detachSession !== "function") continue;
      const accounted = Array.isArray(workspace.sessionIds)
        ? workspace.sessionIds.filter((id) => deletedSet.has(id))
        : [];
      for (const id of accounted) {
        try {
          await workspace.detachSession(id);
        } catch (error) {
          // The durable log is already gone; workspace cleanup is best-effort.
          ctx.logger?.warn?.("better-deepseek-harness: failed to detach deleted session %s from a workspace: %s", id, error?.message ?? error);
        }
      }
    }
  }
  return { deleted: deletable, skipped: live, count: deletable.length };
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
    config: (() => {
      // The vision, Tavily, and GitHub secrets are write-only: never echo
      // them back to the browser; surface only whether each one is configured.
      const vision = config.vision && typeof config.vision === "object" ? { ...config.vision } : {};
      const visionApiKey = typeof vision.apiKey === "string" ? vision.apiKey : "";
      delete vision.apiKey;
      vision.apiKeyConfigured = visionApiKey !== "";
      const tavily = config.tavily && typeof config.tavily === "object" ? { ...config.tavily } : {};
      const tavilyApiKey = typeof tavily.apiKey === "string" ? tavily.apiKey : "";
      delete tavily.apiKey;
      tavily.apiKeyConfigured = tavilyApiKey !== "";
      const github = config.github && typeof config.github === "object" ? { ...config.github } : {};
      const githubToken = typeof github.token === "string" ? github.token : "";
      delete github.token;
      github.tokenConfigured = githubToken !== "";
      return { ...config, vision, tavily, github };
    })(),
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
      visionMaxImagesCap: cfg.vision.maxImagesCap,
      visionMaxTokens: cfg.vision.maxTokens,
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
    requiresLocal: true,
    handler: (_body, cx) => snapshotState(cx)
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
      const { ctx, configOf, cfg } = cx;
      const kind = typeof body.kind === "string" ? body.kind : "";
      const root = resolveTreeRoot(ctx, configOf);
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
    handler: (_body, _cx, query) => {
      const get = query && typeof query.get === "function" ? query.get.bind(query) : () => null;
      const session = terminalSessions.get(String(get("id") || ""));
      if (!session) throw err("not-found", "no such terminal");
      const after = Number(get("after") || 0);
      return terminalOutput(session, Number.isFinite(after) ? after : 0);
    }
  },
  "/ext/api/input/optimize": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => optimizeInput(body, cx)
  },
  "/ext/api/archive/delete": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => deleteArchivedSessions(body, cx)
  },
  "/ext/api/config": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (body, cx) => {
      const { ctx } = cx;
      let settings;
      try {
        settings = ctx.get("settings");
      } catch { /* the settings service is optional in this deployment */ }
      if (!settings || (typeof settings.mutate !== "function" && typeof settings.update !== "function")) {
        throw err("settings-unavailable", "the settings service is not mounted");
      }
      const stored = settings && typeof settings.get === "function" ? settings.get(SETTINGS_NS) : {};
      const storedSection = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      const baseSection = (key) => {
        const base = storedSection[key];
        return base && typeof base === "object" && !Array.isArray(base) ? base : {};
      };
      const patch = {};
      for (const key of ["allowLan", "skillRoot", "customSkillDirs", "treeRoot", "vision", "tavily", "github"]) {
        if (key in body) {
          const value = body[key];
          if (key === "allowLan" && typeof value !== "boolean") throw err("bad-request", "allowLan must be a boolean");
          if (key === "skillRoot" && typeof value !== "string") throw err("bad-request", "skillRoot must be a string");
          if (key === "treeRoot" && typeof value !== "string") throw err("bad-request", "treeRoot must be a string");
          if (key === "customSkillDirs" && (!Array.isArray(value) || value.some((v) => typeof v !== "string"))) throw err("bad-request", "customSkillDirs must be an array of strings");
          if (key === "tavily") {
            if (typeof value !== "object" || value === null || Array.isArray(value)) throw err("bad-request", "tavily must be an object");
            if ("enabled" in value && typeof value.enabled !== "boolean") throw err("bad-request", "tavily.enabled must be a boolean");
            if ("searchDepth" in value && value.searchDepth !== "basic" && value.searchDepth !== "advanced") {
              throw err("bad-request", 'tavily.searchDepth must be "basic" or "advanced"');
            }
            if ("maxResults" in value) {
              const maxResults = Number(value.maxResults);
              if (!Number.isInteger(maxResults) || maxResults < TAVILY_MAX_RESULTS_MIN || maxResults > TAVILY_MAX_RESULTS_MAX) {
                throw err("bad-request", `tavily.maxResults must be an integer between ${TAVILY_MAX_RESULTS_MIN} and ${TAVILY_MAX_RESULTS_MAX}`);
              }
              value.maxResults = maxResults;
            }
            if ("includeRaw" in value && typeof value.includeRaw !== "boolean") throw err("bad-request", "tavily.includeRaw must be a boolean");
            // The API key is write-only from the client's perspective: only a
            // non-empty trimmed string updates the stored key; blank, absent,
            // or wrongly-typed entries leave the stored key untouched. A
            // non-empty entry must look like a Tavily key (format check).
            if ("apiKey" in value) {
              if (typeof value.apiKey !== "string" || value.apiKey.trim() === "") {
                delete value.apiKey;
              } else {
                const trimmed = value.apiKey.trim();
                if (trimmed.length > TAVILY_API_KEY_LIMIT || trimmed.includes("\0")) throw err("bad-request", "tavily.apiKey is invalid");
                const problem = validateTavilyApiKey(trimmed);
                if (problem !== null) throw err("bad-request", problem);
                value.apiKey = trimmed;
              }
            }
            // Sections replace as a whole: carry over untouched stored fields
            // (notably the write-only apiKey) so partial patches never erase them.
            patch[key] = { ...baseSection(key), ...value };
          } else if (key === "vision") {
            if (typeof value !== "object" || value === null || Array.isArray(value)) throw err("bad-request", "vision must be an object");
            // The API key is write-only from the client's perspective: only a
            // non-empty trimmed string updates the stored key; blank, absent,
            // or wrongly-typed entries leave the stored key untouched.
            if ("apiKey" in value) {
              if (typeof value.apiKey !== "string" || value.apiKey.trim() === "") {
                delete value.apiKey;
              } else {
                const trimmed = value.apiKey.trim();
                if (trimmed.length > 4096 || trimmed.includes("\0")) throw err("bad-request", "vision.apiKey is invalid");
                value.apiKey = trimmed;
              }
            }
            if ("maxTokens" in value) {
              const maxTokens = Number(value.maxTokens);
              if (!Number.isFinite(maxTokens) || maxTokens < VISION_MAX_TOKENS_MIN || maxTokens > VISION_MAX_TOKENS_MAX) {
                throw err("bad-request", `vision.maxTokens must be between ${VISION_MAX_TOKENS_MIN} and ${VISION_MAX_TOKENS_MAX}`);
              }
              value.maxTokens = Math.floor(maxTokens);
            }
            if ("maxImages" in value) {
              const maxImages = Number(value.maxImages);
              if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > cx.cfg.vision.maxImagesCap) {
                throw err("bad-request", `vision.maxImages must be an integer between 1 and ${cx.cfg.vision.maxImagesCap}`);
              }
              value.maxImages = maxImages;
            }
            patch[key] = { ...baseSection(key), ...value };
          } else if (key === "github") {
            if (typeof value !== "object" || value === null || Array.isArray(value)) throw err("bad-request", "github must be an object");
            if ("enabled" in value && typeof value.enabled !== "boolean") throw err("bad-request", "github.enabled must be a boolean");
            if ("timeoutMs" in value) {
              const timeoutMs = Number(value.timeoutMs);
              if (!Number.isInteger(timeoutMs) || timeoutMs < GITHUB_TIMEOUT_MIN || timeoutMs > GITHUB_TIMEOUT_MAX) {
                throw err("bad-request", `github.timeoutMs must be an integer between ${GITHUB_TIMEOUT_MIN} and ${GITHUB_TIMEOUT_MAX}`);
              }
              value.timeoutMs = timeoutMs;
            }
            // The token is write-only from the client's perspective: only a
            // non-empty trimmed string updates the stored token; blank,
            // absent, or wrongly-typed entries leave the stored token
            // untouched. A non-empty entry must look like a GitHub token
            // (format check).
            if ("token" in value) {
              if (typeof value.token !== "string" || value.token.trim() === "") {
                delete value.token;
              } else {
                const trimmed = value.token.trim();
                if (trimmed.length > GITHUB_TOKEN_MAX_LENGTH || trimmed.includes("\0")) throw err("bad-request", "github.token is invalid");
                const problem = validateGithubToken(trimmed);
                if (problem !== null) throw err("bad-request", problem);
                value.token = trimmed;
              }
            }
            // Sections replace as a whole: carry over untouched stored fields
            // (notably the write-only token) so partial patches never erase them.
            patch[key] = { ...baseSection(key), ...value };
          } else {
            patch[key] = value;
          }
        }
      }
      const resets = [];
      if (body.reset !== void 0) {
        if (!Array.isArray(body.reset) || body.reset.some((v) => typeof v !== "string")) {
          throw err("bad-request", "reset must be an array of strings");
        }
        for (const key of body.reset) {
          if (!["allowLan", "skillRoot", "customSkillDirs", "treeRoot", "vision", "tavily", "github"].includes(key)) {
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
      // Cache invalidation is best-effort: a missing skills service must not
      // turn a successful settings write into an error response.
      let skills;
      try {
        skills = ctx.get("skills");
      } catch { /* the skills service is optional in this deployment */ }
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
      // let the per-session filesystem providers pick the new skill up (best-effort)
      let skills;
      try {
        skills = ctx.get("skills");
      } catch { /* the skills service is optional in this deployment */ }
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
          rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
      // Windows can transiently lock a directory (AV scans, watchers) — retry
      // the reset instead of failing the install on a short-lived handle.
      rmSync(stagingDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      let manifest;
      let target;
      let pkgName;
      let freshInstall = false;
      let builtFromSource = false;
      try {
        const materialized = await materializePackage(source, stagingDir);
        manifest = materialized.manifest;
        builtFromSource = materialized.builtFromSource;
        pkgName = manifest.name;
        if (pkgName === NAME) throw err("already-installed", NAME + " is built in");
        target = packageDirFor(layout.pluginRoot, pkgName);
        freshInstall = !Object.hasOwn(state, pkgName);
        if (existsSync(target) && freshInstall) throw err("already-exists", `${target} already exists on disk — remove it first or uninstall the tracked package`);
        mkdirSync(dirname(target), { recursive: true });
        rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        // move the staged package into place BEFORE the finally cleans staging
        cpSync(stagingDir, target, { recursive: true });
      } finally {
        // Housekeeping only: a lingering staging dir is cleared by the next
        // install's reset, so a persistent Windows lock must not fail an
        // install that has already moved the package into place.
        try {
          rmSync(stagingDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch (error) {
          ctx.logger?.warn?.("better-deepseek-harness: failed to clean staging dir %s: %s", stagingDir, error?.message ?? error);
        }
      }

      // Bundle patch rows (if the package declares dsh.bundle); a package
      // without one still needs a loader row or it would never activate.
      let record;
      try {
        const bundleRows = bundlePatchRows(target);
        const rows = bundleRows.length > 0 ? bundleRows : [{ insert: [{ id: pkgName, name: pkgName }] }];

        // Reinstall: drop the previous tracked rows first so the merge can
        // re-add them (the loader row must round-trip through the patch file).
        // State, profile manifest, and the patch all update inside one
        // serialized patch-write slot, so a failure before the final rename
        // leaves no half-tracked rows behind.
        await withPatchWrite(layout, async (list) => {
          const previous = state[pkgName];
          if (previous) {
            for (const prevRow of Array.isArray(previous.rows) ? previous.rows : []) {
              const at = findRowIndex(list, prevRow);
              if (at !== -1) list.splice(at, 1);
            }
          }
          // Ids already present anywhere in the composition must not be duplicated.
          const existingIds = new Set(patchListIds(list));
          let loader;
          try {
            loader = ctx.get("loader");
          } catch { /* loader inspection is best-effort */ }
          if (loader && typeof loader.entries === "function") {
            for (const entry of loader.entries()) existingIds.add(String(entry.id));
          }
          const addedRows = mergePatchEntries(list, rows, existingIds);
          record = {
            version: manifest.version ?? "",
            source,
            rows: addedRows,
            builtin: false,
            installedAt: new Date().toISOString()
          };
          if (previous) {
            record.source = previous.source;
            record.builtin = previous.builtin === true;
          }
          state[pkgName] = record;
          // persist dependencies (informational; resolution uses the shared module root)
          const manifestFile = profileManifest(layout);
          manifestFile.dependencies ??= {};
          manifestFile.dependencies[pkgName] = `file:../node_modules/${pkgName}`;
          saveProfileManifest(layout, manifestFile);
          saveState(layout, state);
        });
      } catch (error) {
        // A fresh install that fails after materialization must not leave an
        // untracked package on disk — that would wedge every later install.
        if (freshInstall && target) rmSync(target, { recursive: true, force: true });
        throw error;
      }
      const rowIds = patchListIds(record.rows);
      const applied = await waitForLoaderState(ctx, (entries) => {
        if (rowIds.length === 0) return entries.some((entry) => entry.options?.name === pkgName);
        return rowIds.every((id) => {
          const entry = entries.find((candidate) => String(candidate.id) === id);
          return entry !== void 0 && !entry.disabled;
        });
      });
      return {
        name: pkgName,
        version: record.version,
        rows: record.rows.length,
        builtFromSource,
        restartNeeded: !applied,
        appliedLive: applied,
        note: builtFromSource
          ? "the repository did not ship its built output, so npm install + build ran during install; host rows activated live — a client bundle appears after a page refresh"
          : (applied
            ? "host rows activated live via the config watcher; a client bundle appears after a page refresh"
            : "the config watcher did not confirm the activation — restart dsh web once and the rows from cordis.patch.yml load normally")
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
      const rowIds = patchListIds(record.rows);
      let removedRows = 0;
      await withPatchWrite(layout, (list) => {
        for (const prevRow of Array.isArray(record.rows) ? record.rows : []) {
          const at = findRowIndex(list, prevRow);
          if (at !== -1) {
            list.splice(at, 1);
            removedRows += 1;
          }
        }
      });
      delete state[name];
      const target = packageDirFor(layout.pluginRoot, name);
      rmSync(target, { recursive: true, force: true });
      const manifest = profileManifest(layout);
      if (manifest.dependencies) delete manifest.dependencies[name];
      saveState(layout, state);
      saveProfileManifest(layout, manifest);
      const applied = await waitForLoaderState(ctx, (entries) => {
        if (rowIds.length === 0) return !entries.some((entry) => entry.options?.name === name);
        return !entries.some((entry) => rowIds.includes(String(entry.id)));
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
      const { updatedRows } = await withPatchWrite(layout, (list) => {
        const result = applyPluginDisabled(list, Array.isArray(record.rows) ? record.rows : [], !enabled);
        if (!result.changed) throw err("no-op", `${name} is already ${enabled ? "enabled" : "disabled"}`);
        record.disabled = !enabled;
        record.rows = result.updatedRows;
        saveState(layout, state);
        return result;
      });
      const rowIds = patchListIds(updatedRows);
      const applied = await waitForLoaderState(ctx, (entries) => {
        if (rowIds.length === 0) return entries.some((entry) => entry.options?.name === name && entry.disabled === !enabled);
        return rowIds.every((id) => {
          const entry = entries.find((candidate) => String(candidate.id) === id);
          return entry !== void 0 && entry.disabled === !enabled;
        });
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
    handler: (_body, cx) => mcpSnapshot(cx)
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
  },
  "/ext/api/rescue/status": {
    method: "GET",
    readsBody: false,
    mutating: false,
    requiresLocal: true,
    handler: (_body, cx) => rescueStatusOf(cx)
  },
  "/ext/api/rescue/trigger": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: async (_body, cx) => {
      const outcome = applyRescue(cx, {
        kind: "manual",
        message: "rescue mode was requested manually from the plugin page"
      });
      const status = await rescueStatusOf(cx);
      return { applied: outcome.applied, reason: outcome.reason ?? null, ...status };
    }
  },
  "/ext/api/rescue/apply": {
    method: "POST",
    readsBody: true,
    mutating: true,
    handler: (body, cx) => resolveRescue(body, cx)
  }
};

export { NAME, SETTINGS_NS, apply, inject, materializePackage, packageEntryPoints, packageEntryExists, ensureBuiltPackage, __setRescueHostHooks };
