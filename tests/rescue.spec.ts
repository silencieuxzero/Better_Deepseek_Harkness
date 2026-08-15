import { describe, it, expect } from "vitest";
import {
  RESCUE_STATE_VERSION,
  FIBER_ACTIVE,
  FIBER_FAILED,
  FIBER_PENDING,
  buildRescuePlan,
  buildRestorePlan,
  duplicateEntryIds,
  emptyRescueState,
  isCorePluginName,
  isThirdPartyPluginName,
  markBootHealthy,
  patchRowIds,
  previousBootFailed,
  rescueStatusView,
  sanitizeRescueState,
  startupProblems,
  thirdPartyPatchEntries,
  withBoot,
  type BundleLayerView,
  type LiveEntryView,
  type PatchRow,
  type RescueFailure,
  type RescueState
} from "../src/rescue.js";

/** A rescue failure fixture (crash kind). */
const CRASH: RescueFailure = {
  kind: "crash",
  message: "the previous boot did not complete"
};

/** A third-party patch list fixture: one standalone row, one insert row, plus core/own rows. */
function fixturePatch(): PatchRow[] {
  return [
    { id: "ext-center", name: "better-deepseek-harness", config: { allowLan: false } },
    { id: "a-plugin", name: "a-plugin", config: {} },
    {
      insert: [
        { id: "b-plugin", name: "b-plugin" },
        { id: "core-row", name: "@deepseek-ai/dsh-mcp-client", config: {} },
        { id: "already-off", name: "already-off", disabled: true }
      ]
    },
    { id: "override-only", config: { key: "value" } } // no name — a pure config override
  ];
}

function liveOf(entries: Array<Partial<LiveEntryView> & { id: string; name: string }>): Map<string, LiveEntryView> {
  return new Map(entries.map((entry) => [entry.id, {
    id: entry.id,
    name: entry.name,
    disabled: entry.disabled === true,
    group: entry.group === true,
    fiberState: entry.fiberState
  }]));
}

describe("name classification", () => {
  it("treats the plugin itself and harness core packages as core", () => {
    expect(isCorePluginName("better-deepseek-harness", "better-deepseek-harness")).toBe(true);
    expect(isCorePluginName("@deepseek-ai/dsh-mcp-client", "better-deepseek-harness")).toBe(true);
    expect(isCorePluginName("cordis:include", "better-deepseek-harness")).toBe(true);
  });

  it("treats everything else as third-party", () => {
    expect(isThirdPartyPluginName("a-plugin", "better-deepseek-harness")).toBe(true);
    expect(isThirdPartyPluginName("@dsh-external/dsh-super-injector", "better-deepseek-harness")).toBe(true);
    expect(isThirdPartyPluginName("./local.js", "better-deepseek-harness")).toBe(true);
    expect(isThirdPartyPluginName("", "better-deepseek-harness")).toBe(false);
    expect(isThirdPartyPluginName("better-deepseek-harness", "better-deepseek-harness")).toBe(false);
  });
});

describe("patch row helpers", () => {
  it("collects ids from insert rows and standalone rows", () => {
    expect(patchRowIds({ id: "x" })).toEqual(["x"]);
    expect(patchRowIds({ insert: [{ id: "a" }, { id: "b" }, { name: "no-id" }] })).toEqual(["a", "b"]);
    expect(patchRowIds({})).toEqual([]);
    expect(patchRowIds(null as unknown as PatchRow)).toEqual([]);
  });

  it("detects duplicate ids among inserted entries and bundle layers", () => {
    const list = [
      { id: "a" }, // standalone override — never an entry of its own
      { insert: [{ id: "a" }, { id: "b" }] },
      { id: "c" }
    ];
    // the standalone "a" merges into the inserted entry, so only real entry
    // collisions register
    expect(duplicateEntryIds(list)).toEqual([]);
    expect(duplicateEntryIds(list, ["b", "d"])).toEqual(["b"]);
    expect(duplicateEntryIds([], ["x", "x"])).toEqual(["x"]);
    expect(duplicateEntryIds([{ insert: [{ id: "a" }] }, { insert: [{ id: "a" }] }])).toEqual(["a"]);
    // rescue disable rows merge into their bundle layer: one entry, never a
    // duplicate — otherwise every rescued bundle would flag forever
    expect(duplicateEntryIds([{ id: "rescue-row", disabled: true }], ["rescue-row"])).toEqual([]);
  });
});

describe("thirdPartyPatchEntries", () => {
  it("picks third-party entries and skips core, own, disabled, and nameless rows", () => {
    const found = thirdPartyPatchEntries(fixturePatch(), "better-deepseek-harness");
    expect(found.map((entry) => entry.name).sort()).toEqual(["a-plugin", "b-plugin"]);
    for (const item of found) {
      expect(item.entry.disabled).not.toBe(true);
      expect(item.id).toBe(item.name);
    }
  });

  it("dedupes entries that share a name", () => {
    const list = [
      { id: "x1", name: "dup" },
      { insert: [{ id: "x2", name: "dup" }] }
    ];
    const found = thirdPartyPatchEntries(list, "better-deepseek-harness");
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("x1");
  });
});

describe("startupProblems", () => {
  it("reports nothing for a healthy tree", () => {
    const live = liveOf([
      { id: "a-plugin", name: "a-plugin", fiberState: FIBER_ACTIVE },
      { id: "ext-center", name: "better-deepseek-harness", fiberState: FIBER_ACTIVE }
    ]);
    expect(startupProblems(fixturePatch(), live, "better-deepseek-harness")).toEqual([]);
  });

  it("reports a failed third-party fiber at apply time", () => {
    const live = liveOf([
      { id: "a-plugin", name: "a-plugin", fiberState: FIBER_FAILED },
      { id: "b-plugin", name: "b-plugin", fiberState: FIBER_ACTIVE }
    ]);
    const problems = startupProblems(fixturePatch(), live, "better-deepseek-harness");
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("fiber-failed");
    expect(problems[0].message).toContain("a-plugin");
    expect(problems[0].message).not.toContain("b-plugin");
  });

  it("ignores failed core and disabled entries", () => {
    const live = liveOf([
      { id: "core-row", name: "@deepseek-ai/dsh-mcp-client", fiberState: FIBER_FAILED },
      { id: "already-off", name: "already-off", fiberState: FIBER_FAILED, disabled: true },
      { id: "ext-center", name: "better-deepseek-harness", fiberState: FIBER_FAILED }
    ]);
    expect(startupProblems(fixturePatch(), live, "better-deepseek-harness")).toEqual([]);
  });

  it("counts missing-fiber and pending entries only after the settle window", () => {
    const live = liveOf([
      { id: "a-plugin", name: "a-plugin", fiberState: undefined },
      { id: "b-plugin", name: "b-plugin", fiberState: FIBER_PENDING }
    ]);
    // at apply() time these are indistinguishable from still-loading entries
    expect(startupProblems(fixturePatch(), live, "better-deepseek-harness")).toEqual([]);
    const settled = startupProblems(fixturePatch(), live, "better-deepseek-harness", { includePending: true });
    expect(settled).toHaveLength(1);
    expect(settled[0].kind).toBe("fiber-failed");
    expect(settled[0].message).toContain("a-plugin");
    expect(settled[0].message).toContain("b-plugin");
  });

  it("reports duplicate ids with the duplicate-ids kind", () => {
    const list = [{ insert: [{ id: "a" }] }, { insert: [{ id: "a" }] }];
    const problems = startupProblems(list, new Map(), "better-deepseek-harness");
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("duplicate-ids");
    expect(problems[0].message).toContain("a");
  });

  it("detects an inserted id colliding with a bundle layer id", () => {
    const list = [{ insert: [{ id: "a" }] }];
    const problems = startupProblems(list, new Map(), "better-deepseek-harness", { extraIds: ["a"] });
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("duplicate-ids");
  });
});

describe("buildRescuePlan", () => {
  it("disables every third-party patch entry and keeps core/own rows untouched", () => {
    const plan = buildRescuePlan(fixturePatch(), [], "better-deepseek-harness", new Map(), CRASH);
    expect(plan.changed).toBe(true);
    const byId = new Map(plan.updatedList.flatMap((row) => {
      if (Array.isArray(row.insert)) return row.insert.map((entry) => [String((entry as Record<string, unknown>).id), entry] as const);
      return [[String(row.id), row] as const];
    }));
    expect(byId.get("a-plugin")?.disabled).toBe(true);
    expect(byId.get("b-plugin")?.disabled).toBe(true);
    expect(byId.get("ext-center")).not.toHaveProperty("disabled");
    expect(byId.get("core-row")).not.toHaveProperty("disabled");
    expect(byId.get("already-off")?.disabled).toBe(true); // untouched, stays disabled
    expect(byId.get("override-only")).not.toHaveProperty("disabled");
    expect(plan.plugins.map((plugin) => plugin.name).sort()).toEqual(["a-plugin", "b-plugin"]);
    for (const plugin of plan.plugins) {
      expect(plugin.kind).toBe("patch");
      expect(plugin.reason.code).toBe("crash");
    }
  });

  it("records load-failed reasons for entries whose fiber actually failed", () => {
    const live = liveOf([{ id: "a-plugin", name: "a-plugin", fiberState: FIBER_FAILED }]);
    const plan = buildRescuePlan(fixturePatch(), [], "better-deepseek-harness", live, CRASH);
    const a = plan.plugins.find((plugin) => plugin.name === "a-plugin");
    expect(a?.reason.code).toBe("load-failed");
    const b = plan.plugins.find((plugin) => plugin.name === "b-plugin");
    expect(b?.reason.code).toBe("crash");
  });

  it("appends disable rows for third-party bundle layers, deduped against existing ids", () => {
    const layers: BundleLayerView[] = [
      { name: "@dsh-external/dsh-super-injector", rowIds: ["dsh-super-injector"] },
      { name: "@dsh-external/multi", rowIds: ["m1", "m2"] },
      { name: "@dsh-external/dup", rowIds: ["a-plugin"] } // collides with an existing patch entry
    ];
    const plan = buildRescuePlan(fixturePatch(), layers, "better-deepseek-harness", new Map(), CRASH);
    const rows = plan.updatedList.filter((row) => !Array.isArray(row.insert));
    expect(rows.some((row) => row.id === "dsh-super-injector" && row.disabled === true)).toBe(true);
    expect(rows.some((row) => row.id === "m1" && row.disabled === true)).toBe(true);
    expect(rows.some((row) => row.id === "m2" && row.disabled === true)).toBe(true);
    // the colliding id is already handled by the in-place patch disable — no extra row
    expect(rows.filter((row) => row.id === "a-plugin")).toHaveLength(1);
    const names = plan.plugins.map((plugin) => plugin.name);
    expect(names).toContain("@dsh-external/dsh-super-injector");
    expect(names).toContain("@dsh-external/multi");
    expect(names).not.toContain("@dsh-external/dup");
    const bundle = plan.plugins.find((plugin) => plugin.name === "@dsh-external/multi");
    expect(bundle?.kind).toBe("bundle");
    expect(bundle?.reason.code).toBe("bundle");
  });

  it("never duplicates an existing hand-written disable row", () => {
    const list = [{ id: "x", disabled: true }];
    const layers: BundleLayerView[] = [{ name: "@scope/x", rowIds: ["x"] }];
    const plan = buildRescuePlan(list, layers, "better-deepseek-harness", new Map(), CRASH);
    expect(plan.updatedList.filter((row) => row.id === "x")).toHaveLength(1);
    expect(plan.changed).toBe(false);
  });

  it("changes nothing when there are no third-party plugins", () => {
    const list = [
      { id: "ext-center", name: "better-deepseek-harness" },
      { id: "core-row", name: "@deepseek-ai/dsh-mcp-client" }
    ];
    const plan = buildRescuePlan(list, [], "better-deepseek-harness", new Map(), CRASH);
    expect(plan.changed).toBe(false);
    expect(plan.plugins).toEqual([]);
    expect(plan.updatedList).toEqual(list);
  });

  it("never disables a protected bundle layer (the headless host's front door)", () => {
    // dsh-TUI-style deployment: the front-door bundle mounts itself as a row
    // and rescue must not disable it — that would kill the only surface the
    // user can restore from.
    const layers: BundleLayerView[] = [
      { name: "@deepseek-harness-tui/dsh-tui", rowIds: ["dsh-tui", "agent-loop", "system-prompt", "working-activity"] },
      { name: "@dsh-external/addon", rowIds: ["addon-row"] }
    ];
    const plan = buildRescuePlan(fixturePatch(), layers, "better-deepseek-harness", new Map(), CRASH, ["@deepseek-harness-tui/dsh-tui"]);
    const rows = plan.updatedList.filter((row) => !Array.isArray(row.insert));
    // the protected front door gets no disable rows at all
    for (const id of ["dsh-tui", "agent-loop", "system-prompt", "working-activity"]) {
      expect(rows.some((row) => row.id === id)).toBe(false);
    }
    // the unprotected add-on bundle is still disabled
    expect(rows.some((row) => row.id === "addon-row" && row.disabled === true)).toBe(true);
    const names = plan.plugins.map((plugin) => plugin.name);
    expect(names).not.toContain("@deepseek-harness-tui/dsh-tui");
    expect(names).toContain("@dsh-external/addon");
  });
});

describe("buildRestorePlan", () => {
  function appliedState(plugins: RescueState["plugins"]): RescueState {
    return {
      version: RESCUE_STATE_VERSION,
      phase: "applied",
      failure: CRASH,
      plugins,
      appliedAt: "2026-01-01T00:00:00.000Z",
      boot: { pid: 1, startedAt: 0, healthy: false, healthyAt: null }
    };
  }

  it("re-enables the selected patch plugins and leaves the rest disabled", () => {
    const patch = fixturePatch();
    const applied = buildRescuePlan(patch, [], "better-deepseek-harness", new Map(), CRASH);
    const state = appliedState(applied.plugins);
    const { updatedList, restored } = buildRestorePlan(applied.updatedList, state, ["a-plugin"]);
    const byId = new Map(updatedList.flatMap((row) => {
      if (Array.isArray(row.insert)) return row.insert.map((entry) => [String((entry as Record<string, unknown>).id), entry] as const);
      return [[String(row.id), row] as const];
    }));
    expect(byId.get("a-plugin")).not.toHaveProperty("disabled");
    expect(byId.get("b-plugin")?.disabled).toBe(true);
    expect(restored).toEqual(["a-plugin"]);
  });

  it("removes the bundle disable rows for selected bundles only", () => {
    const layers: BundleLayerView[] = [
      { name: "@dsh-external/a", rowIds: ["a1"] },
      { name: "@dsh-external/b", rowIds: ["b1", "b2"] }
    ];
    const applied = buildRescuePlan(fixturePatch(), layers, "better-deepseek-harness", new Map(), CRASH);
    const state = appliedState(applied.plugins);
    const { updatedList, restored } = buildRestorePlan(applied.updatedList, state, ["@dsh-external/a"]);
    const rows = updatedList.filter((row) => !Array.isArray(row.insert));
    expect(rows.some((row) => row.id === "a1")).toBe(false);
    expect(rows.some((row) => row.id === "b1" && row.disabled === true)).toBe(true);
    expect(rows.some((row) => row.id === "b2" && row.disabled === true)).toBe(true);
    expect(restored).toEqual(["@dsh-external/a"]);
  });

  it("keeps a hand-edited bundle row (extra fields) instead of deleting it", () => {
    const list = [{ id: "b1", disabled: true, config: { keep: true } }];
    const state = appliedState([{ name: "@dsh-external/a", kind: "bundle", reason: { code: "bundle" }, id: "@dsh-external/a", rowIds: ["b1"] }]);
    const { updatedList, restored } = buildRestorePlan(list, state, ["@dsh-external/a"]);
    expect(updatedList).toEqual(list); // untouched
    expect(restored).toEqual([]);
  });

  it("restores nothing for an empty selection", () => {
    const applied = buildRescuePlan(fixturePatch(), [], "better-deepseek-harness", new Map(), CRASH);
    const state = appliedState(applied.plugins);
    const { updatedList, restored } = buildRestorePlan(applied.updatedList, state, []);
    expect(restored).toEqual([]);
    const byId = new Map(updatedList.flatMap((row) => {
      if (Array.isArray(row.insert)) return row.insert.map((entry) => [String((entry as Record<string, unknown>).id), entry] as const);
      return [[String(row.id), row] as const];
    }));
    expect(byId.get("a-plugin")?.disabled).toBe(true);
  });
});

describe("state machine", () => {
  it("starts empty with no previous boot", () => {
    const state = emptyRescueState();
    expect(state.phase).toBe("idle");
    expect(previousBootFailed(state)).toBe(false);
  });

  it("treats an un-settled recorded boot as failed", () => {
    const state = withBoot(emptyRescueState(), 42, 1000);
    expect(previousBootFailed(state)).toBe(true);
  });

  it("treats a settled boot as healthy", () => {
    const state = markBootHealthy(withBoot(emptyRescueState(), 42, 1000), 2000);
    expect(previousBootFailed(state)).toBe(false);
    expect(state.boot.healthy).toBe(true);
  });

  it("sanitizes malformed state files to safe defaults", () => {
    // a well-formed phase survives; malformed fields fall back independently
    const state = sanitizeRescueState({ phase: "applied", boot: { pid: "x", healthy: 1 }, plugins: [{ name: 5 }] });
    expect(state.phase).toBe("applied");
    expect(state.boot.pid).toBe(0);
    expect(state.boot.healthy).toBe(false);
    expect(state.plugins).toEqual([]);
    expect(sanitizeRescueState(null)).toEqual(emptyRescueState());
    expect(sanitizeRescueState("garbage")).toEqual(emptyRescueState());
    expect(sanitizeRescueState({ phase: "bogus" }).phase).toBe("idle");
  });

  it("keeps only well-formed plugin records", () => {
    const state = sanitizeRescueState({
      version: 1,
      phase: "applied",
      failure: { kind: "crash", message: "boom" },
      plugins: [
        { name: "a", kind: "patch", reason: { code: "crash" }, id: "a", rowIds: ["a"] },
        { name: "bad", kind: "patch", reason: { code: "nope" }, id: "bad", rowIds: [] },
        { name: "b", kind: "bundle", reason: { code: "bundle" }, id: "b", rowIds: ["b1"] }
      ],
      appliedAt: "x",
      boot: { pid: 7, startedAt: 1, healthy: true, healthyAt: 2 }
    });
    expect(state.phase).toBe("applied");
    expect(state.failure?.message).toBe("boom");
    expect(state.plugins.map((plugin) => plugin.name)).toEqual(["a", "b"]);
    expect(state.boot.pid).toBe(7);
    expect(state.boot.healthy).toBe(true);
  });

  it("exposes a status view without row shapes", () => {
    const state = withBoot(emptyRescueState(), 1, 0);
    const applied = { ...state, phase: "applied" as const, failure: CRASH, plugins: [
      { name: "a", kind: "patch" as const, reason: { code: "load-failed" as const, detail: "err" }, id: "a", rowIds: ["a"] }
    ], appliedAt: "x" };
    const view = rescueStatusView(applied);
    expect(view.active).toBe(true);
    expect(view.plugins).toEqual([{ name: "a", kind: "patch", reason: { code: "load-failed", detail: "err" } }]);
    expect(rescueStatusView(state).active).toBe(false);
  });
});
