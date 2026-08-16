/**
 * Rescue mode — pure logic, no I/O.
 *
 * When DeepSeek Harness fails to boot (a third-party plugin is not built, two
 * plugins conflict, a duplicate loader entry id crashes the tree, ...), the
 * harness cannot recover by itself: the boot audit rejects the whole startup
 * and the process exits. Rescue mode makes the NEXT boot deterministic:
 *
 *   - every boot writes a boot record (pid + startedAt, healthy=false) to the
 *     rescue state file; the settle window that follows marks it healthy;
 *   - a boot that never settles (crashed) leaves `healthy=false`, so the next
 *     boot detects "the previous boot failed" and applies rescue: every
 *     third-party plugin (anything that is not this plugin and not a harness
 *     core package — `@deepseek-ai/*` or `cordis:*`) is disabled in the
 *     profile patch, which the boot HMR watcher hot-applies; the harness then
 *     runs with the minimal configuration;
 *   - startup problems are also detected live (failed fibers of third-party
 *     entries, duplicate loader entry ids in the composed patch), so rescue
 *     can apply during the very boot that would otherwise die;
 *   - once the minimal boot succeeds, the Web UI shows a dialog listing every
 *     disabled plugin (name + reason); the user picks which to re-enable
 *     ("restore all" / "keep disabled" / a selection), the selection is
 *     applied back to the patch, and the harness reloads.
 *
 * This module is deliberately pure: it decides and plans over plain data (the
 * patch list, the live loader entry views, the state file contents) and never
 * touches the filesystem, the loader, or the process. The host wiring in
 * `src/index.js` supplies all I/O and calls these functions; unit tests
 * exercise the decisions without any harness.
 *
 * Safety properties that live here:
 *   - the plugin's own row and every harness-core row are never disabled;
 *   - rows without a `name` (pure config overrides) are never disabled;
 *   - already-disabled entries are never touched;
 *   - a rescue plan that disables nothing changes nothing.
 */

/** Sidecar state file name, next to the profile's cordis.patch.yml. */
export const RESCUE_FILE = ".dsh-rescue.json";
/** Version of the sidecar state file format. */
export const RESCUE_STATE_VERSION = 1;

/** Loader fiber states (mirrors the cordis FiberState const enum). */
export const FIBER_PENDING = 0;
export const FIBER_LOADING = 1;
export const FIBER_ACTIVE = 2;
export const FIBER_FAILED = 3;

/** Why rescue mode was entered (or requested). */
export type RescueFailureKind = "crash" | "fiber-failed" | "duplicate-ids" | "manual";

/** The overall failure that triggered rescue mode. */
export interface RescueFailure {
  kind: RescueFailureKind;
  message: string;
}

/** Per-plugin disable reason; the client localizes `code` and appends `detail`. */
export interface RescueReason {
  code: "crash" | "load-failed" | "duplicate-ids" | "manual" | "bundle";
  /** Optional English detail (e.g. the loader's own failure text). */
  detail?: string;
}

/** One plugin disabled by rescue mode, with enough shape to restore it later. */
export interface RescuePluginEntry {
  /** Plugin name (dialog identity; also the restore key). */
  name: string;
  /** "patch" = a row in the profile patch; "bundle" = a profile bundle layer. */
  kind: "patch" | "bundle";
  reason: RescueReason;
  /** patch: the entry id inside its row; bundle: the bundle package name. */
  id: string;
  /** bundle: the loader row ids the bundle layer declares (disable rows target these). */
  rowIds: string[];
}

/** The rescue sidecar state (`.dsh-rescue.json`). */
export interface RescueState {
  version: number;
  /** "idle" = normal mode; "applied" = a rescue disable is live and the dialog should show. */
  phase: "idle" | "applied";
  failure: RescueFailure | null;
  plugins: RescuePluginEntry[];
  appliedAt: string | null;
  /** The most recent boot's marker: healthy=false until the settle window passes. */
  boot: { pid: number; startedAt: number; healthy: boolean; healthyAt: number | null };
}

/** The slice of a live loader entry rescue mode cares about. */
export interface LiveEntryView {
  id: string;
  name: string;
  disabled: boolean;
  group: boolean | null | undefined;
  /** cordis FiberState; undefined when the entry has no fiber (failed to resolve). */
  fiberState: number | undefined;
}

/** One patch-file row (a plain object; `!!js` expressions stay opaque). */
export type PatchRow = Record<string, unknown>;

/** A resolved profile bundle layer (third-party only, resolved by the host). */
export interface BundleLayerView {
  /** Bundle package name (e.g. "@dsh-external/dsh-super-injector"). */
  name: string;
  /** Loader row ids declared by the bundle's own patch file. */
  rowIds: string[];
}

/** A startup problem detected at boot (first problem wins the failure record). */
export interface StartupProblem {
  kind: "fiber-failed" | "duplicate-ids";
  message: string;
}

/** The outcome of planning one rescue apply. */
export interface RescuePlan {
  /** The patch list with third-party entries disabled and bundle disable rows appended. */
  updatedList: PatchRow[];
  /** The plugins this plan disables (dialog + state). */
  plugins: RescuePluginEntry[];
  /** False when there was nothing third-party to disable. */
  changed: boolean;
}

/** The outcome of planning one user confirmation. */
export interface RestorePlan {
  updatedList: PatchRow[];
  /** The names whose disabled flags were actually removed. */
  restored: string[];
}

/** A fresh, empty rescue state (pid 0 = "no previous boot"). */
export function emptyRescueState(now = 0): RescueState {
  return {
    version: RESCUE_STATE_VERSION,
    phase: "idle",
    failure: null,
    plugins: [],
    appliedAt: null,
    boot: { pid: 0, startedAt: now, healthy: false, healthyAt: null }
  };
}

/** Overwrite the boot record with a fresh un-settled marker. */
export function withBoot(state: RescueState, pid: number, startedAt: number): RescueState {
  return { ...state, boot: { pid, startedAt, healthy: false, healthyAt: null } };
}

/** Mark the current boot settled (the settle window passed without problems). */
export function markBootHealthy(state: RescueState, now: number): RescueState {
  return { ...state, boot: { ...state.boot, healthy: true, healthyAt: now } };
}

/** Whether the recorded previous boot never settled (i.e. it failed at startup). */
export function previousBootFailed(state: RescueState): boolean {
  return state.boot.pid !== 0 && state.boot.healthy !== true;
}

/**
 * Validate and normalize a raw state-file value into a {@link RescueState}.
 * Anything malformed falls back to safe defaults; hostile field values are
 * dropped instead of trusted.
 */
export function sanitizeRescueState(raw: unknown): RescueState {
  const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const bootRaw = obj.boot !== null && typeof obj.boot === "object" && !Array.isArray(obj.boot)
    ? obj.boot as Record<string, unknown>
    : {};
  return {
    version: RESCUE_STATE_VERSION,
    phase: obj.phase === "applied" ? "applied" : "idle",
    failure: isRescueFailure(obj.failure) ? obj.failure : null,
    plugins: Array.isArray(obj.plugins) ? obj.plugins.filter(isRescuePluginEntry) : [],
    appliedAt: typeof obj.appliedAt === "string" ? obj.appliedAt : null,
    boot: {
      pid: typeof bootRaw.pid === "number" && Number.isFinite(bootRaw.pid) && bootRaw.pid > 0 ? bootRaw.pid : 0,
      startedAt: typeof bootRaw.startedAt === "number" && Number.isFinite(bootRaw.startedAt) ? bootRaw.startedAt : 0,
      healthy: bootRaw.healthy === true,
      healthyAt: typeof bootRaw.healthyAt === "number" && Number.isFinite(bootRaw.healthyAt) ? bootRaw.healthyAt : null
    }
  };
}

function isRescueFailure(value: unknown): value is RescueFailure {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isRescueFailureKind(candidate.kind) && typeof candidate.message === "string";
}

function isRescueFailureKind(value: unknown): value is RescueFailureKind {
  return value === "crash" || value === "fiber-failed" || value === "duplicate-ids" || value === "manual";
}

function isRescuePluginEntry(value: unknown): value is RescuePluginEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const reason = candidate.reason;
  if (reason === null || typeof reason !== "object" || Array.isArray(reason)) return false;
  const reasonCode = (reason as Record<string, unknown>).code;
  const codeOk = reasonCode === "crash" || reasonCode === "load-failed"
    || reasonCode === "duplicate-ids" || reasonCode === "manual" || reasonCode === "bundle";
  return typeof candidate.name === "string"
    && (candidate.kind === "patch" || candidate.kind === "bundle")
    && typeof candidate.id === "string"
    && codeOk
    && Array.isArray(candidate.rowIds)
    && candidate.rowIds.every((id) => typeof id === "string");
}

/** Harness core packages are never treated as third-party. */
export function isCorePluginName(name: string, ownName: string): boolean {
  return name === ownName || name.startsWith("@deepseek-ai/") || name.startsWith("cordis:");
}

/** A plugin name rescue mode may disable: non-empty, not core, not ours. */
export function isThirdPartyPluginName(name: string, ownName: string): boolean {
  return name !== "" && !isCorePluginName(name, ownName);
}

/** All entry ids carried by one patch row (insert entries or a standalone row). */
export function patchRowIds(row: PatchRow): string[] {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return [];
  if (Array.isArray(row.insert)) {
    const ids: string[] = [];
    for (const entry of row.insert) {
      if (entry !== null && typeof entry === "object" && !Array.isArray(entry) && typeof (entry as Record<string, unknown>).id === "string") {
        ids.push(String((entry as Record<string, unknown>).id));
      }
    }
    return ids;
  }
  return typeof row.id === "string" ? [row.id] : [];
}

/** All entry ids carried by a patch list (top-level rows and insert entries). */
export function patchListIds(list: PatchRow[]): string[] {
  const ids: string[] = [];
  for (const row of list) ids.push(...patchRowIds(row));
  return ids;
}

/**
 * Entry ids that INSERT rows declare — the only rows that create entries in
 * the composed tree. Standalone rows are id-targeted overrides that merge
 * into an existing entry (or warn-skip when no target exists), so they never
 * add an entry and never collide by themselves.
 */
export function insertedEntryIds(list: PatchRow[]): string[] {
  const ids: string[] = [];
  for (const row of list) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
    if (!Array.isArray(row.insert)) continue;
    for (const entry of row.insert) {
      if (entry !== null && typeof entry === "object" && !Array.isArray(entry) && typeof (entry as Record<string, unknown>).id === "string") {
        ids.push(String((entry as Record<string, unknown>).id));
      }
    }
  }
  return ids;
}

/**
 * Entry ids that would collide in the composed tree: ids declared by INSERT
 * rows plus ids declared by profile bundle layers (`extraIds`). Standalone
 * patch rows are excluded on purpose — rescue's own bundle disable rows
 * (`{ id, disabled: true }`) sit next to their bundle layer in the patch file
 * but merge into that layer's entry instead of creating a second one, so
 * counting them would flag every rescued bundle as a duplicate forever.
 */
export function duplicateEntryIds(list: PatchRow[], extraIds: string[] = []): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of [...insertedEntryIds(list), ...extraIds]) {
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }
  return [...duplicates].sort();
}

/**
 * The patch-layer plugin entries rescue mode may disable: insert entries and
 * standalone rows that carry a third-party `name`, are not already disabled,
 * and are not duplicated by name (the dialog lists one row per plugin).
 */
export function thirdPartyPatchEntries(
  list: PatchRow[],
  ownName: string
): Array<{ row: PatchRow; entry: Record<string, unknown>; name: string; id: string }> {
  const found: Array<{ row: PatchRow; entry: Record<string, unknown>; name: string; id: string }> = [];
  const seen = new Set<string>();
  for (const row of list) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
    const consider = (entry: unknown): void => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return;
      const candidate = entry as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id : "";
      const name = typeof candidate.name === "string" ? candidate.name : "";
      if (id === "" || candidate.disabled === true || !isThirdPartyPluginName(name, ownName)) return;
      if (seen.has(name)) return;
      seen.add(name);
      found.push({ row, entry: candidate, name, id });
    };
    if (Array.isArray(row.insert)) {
      for (const entry of row.insert) consider(entry);
    } else {
      consider(row);
    }
  }
  return found;
}

/**
 * Detect startup problems from the patch list and the live loader views.
 * `includePending` (the settle-window check) also counts entries that never
 * got a fiber (module resolution failed) or are still pending — at apply()
 * time those are indistinguishable from entries that are merely still
 * loading, so they are only counted after the settle window.
 */
export function startupProblems(
  list: PatchRow[],
  live: Map<string, LiveEntryView>,
  ownName: string,
  options: { includePending?: boolean; extraIds?: string[] } = {}
): StartupProblem[] {
  const problems: StartupProblem[] = [];
  const duplicates = duplicateEntryIds(list, options.extraIds ?? []);
  if (duplicates.length > 0) {
    problems.push({
      kind: "duplicate-ids",
      message: `duplicate loader entry id(s): ${duplicates.join(", ")} — the loader tree crashes on duplicate ids at boot`
    });
  }
  const failed: string[] = [];
  for (const entry of live.values()) {
    if (entry.group === true || entry.disabled || !isThirdPartyPluginName(entry.name, ownName)) continue;
    if (entry.fiberState === FIBER_FAILED) {
      failed.push(entry.name);
    } else if (options.includePending === true) {
      if (entry.fiberState === undefined || entry.fiberState === FIBER_PENDING) failed.push(entry.name);
    }
  }
  if (failed.length > 0) {
    problems.push({
      kind: "fiber-failed",
      message: `third-party plugin(s) failed to start: ${failed.join(", ")}`
    });
  }
  return problems;
}

/**
 * Build the rescue plan: disable every third-party patch-layer entry in a
 * deep copy of the list, and append id-targeted disable rows for third-party
 * profile bundle layers. Per-plugin reasons follow the failure kind, falling
 * back to "load-failed" when a live fiber actually failed.
 *
 * `protectLayerNames` names bundle layers that must never be disabled: the
 * host's own front door in headless/TUI deployments (auto-detected by the
 * host), plus any bundle the deployment pinned via `rescue.protectBundles`.
 */
export function buildRescuePlan(
  list: PatchRow[],
  bundleLayers: BundleLayerView[],
  ownName: string,
  live: Map<string, LiveEntryView>,
  failure: RescueFailure,
  protectLayerNames: Iterable<string> = []
): RescuePlan {
  const updatedList = structuredClone(list);
  const plugins: RescuePluginEntry[] = [];
  const seenNames = new Set<string>();
  const liveById = new Map<string, LiveEntryView>();
  const protect = new Set(protectLayerNames);
  for (const entry of live.values()) liveById.set(entry.id, entry);

  for (const found of thirdPartyPatchEntries(updatedList, ownName)) {
    found.entry.disabled = true;
    if (seenNames.has(found.name)) continue;
    seenNames.add(found.name);
    const liveEntry = liveById.get(found.id);
    const code: RescueReason["code"] = liveEntry?.fiberState === FIBER_FAILED
      ? "load-failed"
      : failure.kind === "duplicate-ids"
        ? "duplicate-ids"
        : failure.kind === "manual"
          ? "manual"
          : "crash";
    plugins.push({
      name: found.name,
      kind: "patch",
      reason: { code },
      id: found.id,
      rowIds: [found.id]
    });
  }

  // Third-party profile bundles: target their loader row ids with disable
  // rows (the patch layer overrides bundle layers). Rows already present in
  // the patch (hand-written disables or an entry with the same id) are left
  // alone — an existing target already handles the entry. Protected layers
  // (the host's own front door) are skipped entirely: disabling them would
  // kill the only surface the user can restore from.
  const existingIds = new Set(patchListIds(updatedList));
  for (const layer of bundleLayers) {
    if (protect.has(layer.name) || seenNames.has(layer.name) || !isThirdPartyPluginName(layer.name, ownName)) continue;
    const added: string[] = [];
    for (const rowId of layer.rowIds) {
      if (existingIds.has(rowId)) continue;
      updatedList.push({ id: rowId, disabled: true });
      added.push(rowId);
      existingIds.add(rowId);
    }
    if (added.length === 0) continue;
    seenNames.add(layer.name);
    plugins.push({
      name: layer.name,
      kind: "bundle",
      reason: { code: failure.kind === "manual" ? "manual" : "bundle" },
      id: layer.name,
      rowIds: added
    });
  }

  return { updatedList, plugins, changed: plugins.length > 0 };
}

/**
 * Plan the user's confirmation: re-enable the selected plugins (remove their
 * `disabled` flags / the bundle disable rows we added) and leave everything
 * unselected disabled. An empty selection restores nothing.
 */
export function buildRestorePlan(
  list: PatchRow[],
  state: RescueState,
  enableNames: string[]
): RestorePlan {
  const updatedList = structuredClone(list);
  const enableSet = new Set(enableNames);
  const restored: string[] = [];
  for (const plugin of state.plugins) {
    if (!enableSet.has(plugin.name)) continue;
    if (plugin.kind === "patch") {
      for (const row of updatedList) {
        if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
        if (Array.isArray(row.insert)) {
          for (const entry of row.insert) {
            if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
            const candidate = entry as Record<string, unknown>;
            // The disable plan dedupes by plugin NAME, so a package that
            // appears under two different entry ids was fully disabled but is
            // only listed once; restoring that name must re-enable every row
            // carrying it (id equality still covers renamed rows).
            if (candidate.disabled === true && (candidate.id === plugin.id || candidate.name === plugin.name)) {
              delete candidate.disabled;
              if (!restored.includes(plugin.name)) restored.push(plugin.name);
            }
          }
        } else if (row.disabled === true && (row.id === plugin.id || row.name === plugin.name)) {
          delete row.disabled;
          if (!restored.includes(plugin.name)) restored.push(plugin.name);
        }
      }
    } else {
      const rowIds = new Set(plugin.rowIds);
      for (let index = updatedList.length - 1; index >= 0; index -= 1) {
        const row = updatedList[index];
        if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
        if (Array.isArray(row.insert)) continue;
        // Only the exact disable rows rescue mode added ({id, disabled:true})
        // are removed — a hand-edited row (extra fields) is left alone.
        if (rowIds.has(String(row.id ?? "")) && row.disabled === true && Object.keys(row).length === 2) {
          updatedList.splice(index, 1);
          if (!restored.includes(plugin.name)) restored.push(plugin.name);
        }
      }
    }
  }
  return { updatedList, restored };
}

/** The status payload the Web UI polls (no row shapes, no secrets). */
export function rescueStatusView(state: RescueState): {
  phase: "idle" | "applied";
  active: boolean;
  failure: RescueFailure | null;
  plugins: Array<{ name: string; kind: "patch" | "bundle"; reason: RescueReason }>;
  appliedAt: string | null;
} {
  return {
    phase: state.phase,
    active: state.phase === "applied",
    failure: state.failure,
    plugins: state.plugins.map((plugin) => ({
      name: plugin.name,
      kind: plugin.kind,
      reason: plugin.reason
    })),
    appliedAt: state.appliedAt
  };
}
