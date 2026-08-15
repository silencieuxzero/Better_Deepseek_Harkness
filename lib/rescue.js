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
/** A fresh, empty rescue state (pid 0 = "no previous boot"). */
export function emptyRescueState(now = 0) {
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
export function withBoot(state, pid, startedAt) {
    return { ...state, boot: { pid, startedAt, healthy: false, healthyAt: null } };
}
/** Mark the current boot settled (the settle window passed without problems). */
export function markBootHealthy(state, now) {
    return { ...state, boot: { ...state.boot, healthy: true, healthyAt: now } };
}
/** Whether the recorded previous boot never settled (i.e. it failed at startup). */
export function previousBootFailed(state) {
    return state.boot.pid !== 0 && state.boot.healthy !== true;
}
/**
 * Validate and normalize a raw state-file value into a {@link RescueState}.
 * Anything malformed falls back to safe defaults; hostile field values are
 * dropped instead of trusted.
 */
export function sanitizeRescueState(raw) {
    const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw)
        ? raw
        : {};
    const bootRaw = obj.boot !== null && typeof obj.boot === "object" && !Array.isArray(obj.boot)
        ? obj.boot
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
function isRescueFailure(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return isRescueFailureKind(candidate.kind) && typeof candidate.message === "string";
}
function isRescueFailureKind(value) {
    return value === "crash" || value === "fiber-failed" || value === "duplicate-ids" || value === "manual";
}
function isRescuePluginEntry(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    const reason = candidate.reason;
    if (reason === null || typeof reason !== "object" || Array.isArray(reason))
        return false;
    const reasonCode = reason.code;
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
export function isCorePluginName(name, ownName) {
    return name === ownName || name.startsWith("@deepseek-ai/") || name.startsWith("cordis:");
}
/** A plugin name rescue mode may disable: non-empty, not core, not ours. */
export function isThirdPartyPluginName(name, ownName) {
    return name !== "" && !isCorePluginName(name, ownName);
}
/** All entry ids carried by one patch row (insert entries or a standalone row). */
export function patchRowIds(row) {
    if (row === null || typeof row !== "object" || Array.isArray(row))
        return [];
    if (Array.isArray(row.insert)) {
        const ids = [];
        for (const entry of row.insert) {
            if (entry !== null && typeof entry === "object" && !Array.isArray(entry) && typeof entry.id === "string") {
                ids.push(String(entry.id));
            }
        }
        return ids;
    }
    return typeof row.id === "string" ? [row.id] : [];
}
/** All entry ids carried by a patch list (top-level rows and insert entries). */
export function patchListIds(list) {
    const ids = [];
    for (const row of list)
        ids.push(...patchRowIds(row));
    return ids;
}
/**
 * Entry ids that appear more than once in the combined set — the
 * "duplicate loader entry id" condition that crashes the loader tree at
 * boot. `extraIds` carries ids that exist outside the patch list (profile
 * bundle layers), so patch-vs-bundle duplicates are caught as well.
 */
export function duplicateEntryIds(list, extraIds = []) {
    const seen = new Set();
    const duplicates = new Set();
    for (const id of [...patchListIds(list), ...extraIds]) {
        if (seen.has(id))
            duplicates.add(id);
        else
            seen.add(id);
    }
    return [...duplicates].sort();
}
/**
 * The patch-layer plugin entries rescue mode may disable: insert entries and
 * standalone rows that carry a third-party `name`, are not already disabled,
 * and are not duplicated by name (the dialog lists one row per plugin).
 */
export function thirdPartyPatchEntries(list, ownName) {
    const found = [];
    const seen = new Set();
    for (const row of list) {
        if (row === null || typeof row !== "object" || Array.isArray(row))
            continue;
        const consider = (entry) => {
            if (entry === null || typeof entry !== "object" || Array.isArray(entry))
                return;
            const candidate = entry;
            const id = typeof candidate.id === "string" ? candidate.id : "";
            const name = typeof candidate.name === "string" ? candidate.name : "";
            if (id === "" || candidate.disabled === true || !isThirdPartyPluginName(name, ownName))
                return;
            if (seen.has(name))
                return;
            seen.add(name);
            found.push({ row, entry: candidate, name, id });
        };
        if (Array.isArray(row.insert)) {
            for (const entry of row.insert)
                consider(entry);
        }
        else {
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
export function startupProblems(list, live, ownName, options = {}) {
    const problems = [];
    const duplicates = duplicateEntryIds(list, options.extraIds ?? []);
    if (duplicates.length > 0) {
        problems.push({
            kind: "duplicate-ids",
            message: `duplicate loader entry id(s): ${duplicates.join(", ")} — the loader tree crashes on duplicate ids at boot`
        });
    }
    const failed = [];
    for (const entry of live.values()) {
        if (entry.group === true || entry.disabled || !isThirdPartyPluginName(entry.name, ownName))
            continue;
        if (entry.fiberState === FIBER_FAILED) {
            failed.push(entry.name);
        }
        else if (options.includePending === true) {
            if (entry.fiberState === undefined || entry.fiberState === FIBER_PENDING)
                failed.push(entry.name);
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
export function buildRescuePlan(list, bundleLayers, ownName, live, failure, protectLayerNames = []) {
    const updatedList = structuredClone(list);
    const plugins = [];
    const seenNames = new Set();
    const liveById = new Map();
    const protect = new Set(protectLayerNames);
    for (const entry of live.values())
        liveById.set(entry.id, entry);
    for (const found of thirdPartyPatchEntries(updatedList, ownName)) {
        found.entry.disabled = true;
        if (seenNames.has(found.name))
            continue;
        seenNames.add(found.name);
        const liveEntry = liveById.get(found.id);
        const code = liveEntry?.fiberState === FIBER_FAILED
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
        if (protect.has(layer.name) || seenNames.has(layer.name) || !isThirdPartyPluginName(layer.name, ownName))
            continue;
        const added = [];
        for (const rowId of layer.rowIds) {
            if (existingIds.has(rowId))
                continue;
            updatedList.push({ id: rowId, disabled: true });
            added.push(rowId);
            existingIds.add(rowId);
        }
        if (added.length === 0)
            continue;
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
export function buildRestorePlan(list, state, enableNames) {
    const updatedList = structuredClone(list);
    const enableSet = new Set(enableNames);
    const restored = [];
    for (const plugin of state.plugins) {
        if (!enableSet.has(plugin.name))
            continue;
        if (plugin.kind === "patch") {
            for (const row of updatedList) {
                if (row === null || typeof row !== "object" || Array.isArray(row))
                    continue;
                if (Array.isArray(row.insert)) {
                    for (const entry of row.insert) {
                        if (entry === null || typeof entry !== "object" || Array.isArray(entry))
                            continue;
                        const candidate = entry;
                        if (candidate.id === plugin.id && candidate.disabled === true) {
                            delete candidate.disabled;
                            if (!restored.includes(plugin.name))
                                restored.push(plugin.name);
                        }
                    }
                }
                else if (row.id === plugin.id && row.disabled === true) {
                    delete row.disabled;
                    if (!restored.includes(plugin.name))
                        restored.push(plugin.name);
                }
            }
        }
        else {
            const rowIds = new Set(plugin.rowIds);
            for (let index = updatedList.length - 1; index >= 0; index -= 1) {
                const row = updatedList[index];
                if (row === null || typeof row !== "object" || Array.isArray(row))
                    continue;
                if (Array.isArray(row.insert))
                    continue;
                // Only the exact disable rows rescue mode added ({id, disabled:true})
                // are removed — a hand-edited row (extra fields) is left alone.
                if (rowIds.has(String(row.id ?? "")) && row.disabled === true && Object.keys(row).length === 2) {
                    updatedList.splice(index, 1);
                    if (!restored.includes(plugin.name))
                        restored.push(plugin.name);
                }
            }
        }
    }
    return { updatedList, restored };
}
/** The status payload the Web UI polls (no row shapes, no secrets). */
export function rescueStatusView(state) {
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
