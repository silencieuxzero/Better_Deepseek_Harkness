import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { apply, inject, NAME, SETTINGS_NS, materializePackage, packageEntryPoints, packageEntryExists, ensureBuiltPackage, __setRescueHostHooks } from "../src/index.js";

/**
 * A minimal cordis ctx double for apply(). `baseUrl` must be a real file URL
 * because resolveLayout() derives the profile directory from it; nothing is
 * written during apply(), so pointing it at lib/index.js is safe.
 */
interface MockOptions {
  /** settings.get() result — the stored ext-center section. */
  stored?: Record<string, unknown>;
  /** value returned for ctx.get("llm") (defaults to undefined). */
  llm?: {
    stream: (options: unknown) => AsyncIterable<unknown>;
    resolveModelInfo?: (provider: string, model: string, signal?: unknown) => Promise<{ inputModalities?: string[] }>;
  } | undefined;
  /** value returned for ctx.get("attachments") (defaults to undefined). */
  attachments?: { readImage: (ref: unknown, signal?: unknown) => Promise<{ ref: { mediaType: string }, data: Uint8Array }> } | undefined;
  /** value returned for ctx.get("workspaceRegistry") (defaults to undefined). */
  workspaceRegistry?: {
    archivedSessionIds: string[];
    list?: () => Array<{ sessionIds: string[]; detachSession: (id: string) => Promise<void> | void }>;
  } | undefined;
  /** value returned for ctx.get("sessionPersistence") (defaults to undefined). */
  sessionPersistence?: {
    list: () => Promise<Array<{ id: string }>>;
    locate: (header: { id: string }) => { path: string };
  } | undefined;
  /** value returned for ctx.get("sessions") (defaults to undefined). */
  sessions?: { get: (id: string) => unknown } | undefined;
  /** when true, ctx.get("webServer") reports the service as absent (headless/TUI host). */
  noWebServer?: boolean;
  /** value returned for ctx.get("commands") (defaults to undefined — no command registry). */
  commands?: { register: ReturnType<typeof vi.fn> };
  /** when true, ctx.inject stores the callback instead of running it now. */
  deferInject?: boolean;
  /** when true, ctx.get("settings") throws like a missing cordis service. */
  noSettings?: boolean;
  /** when true, ctx.get("skills") throws like a missing cordis service. */
  noSkills?: boolean;
  /** baseUrl override — tests point it at a temp profile directory. */
  baseUrl?: string;
  /** loader entry snapshots returned by ctx.get("loader").entries(). */
  loaderEntries?: Array<{
    id: string;
    options?: { name?: string; group?: boolean };
    disabled?: boolean;
    fiber?: { state?: number };
  }>;
}

function mockCtx(options: MockOptions = {}) {
  const disposers: Array<() => void> = [];
  const registrations: {
    routes: Array<{ path: string; handler: (req: unknown, res: unknown) => Promise<void> }>;
    events: string[];
  } = { routes: [], events: [] };
  const settings = {
    register: vi.fn(() => ({
      get: () => options.stored ?? {},
      watch: vi.fn(() => () => {}),
      update: vi.fn(async () => {}),
      replace: vi.fn(async () => {})
    })),
    get: vi.fn(() => options.stored ?? {}),
    update: vi.fn(async (_ns: string, _patch: Record<string, unknown>) => {}),
    mutate: vi.fn(async (_ns: string, _ops: Array<Record<string, unknown>>) => {}),
    writable: true
  };
  const skills = { registerProvider: vi.fn(() => () => {}) };
  const loader = {
    entries: vi.fn(() => options.loaderEntries ?? []),
    resolve: vi.fn(() => undefined)
  };
  const pendingInject: Array<(child: unknown) => void> = [];
  const webServer = {
    register: vi.fn((entry: { path: string; handler: (req: unknown, res: unknown) => Promise<void> }) => {
      registrations.routes.push(entry);
      return () => {};
    })
  };
  const ctx = {
    baseUrl: options.baseUrl ?? pathToFileURL(join(process.cwd(), "lib", "index.js")).href,
    get: vi.fn((name: string) => {
      // cordis throws when the requested service is not mounted; the plugin
      // must treat every optional service lookup as best-effort.
      if (name === "settings" && options.noSettings) throw new Error("service settings is not mounted");
      if (name === "skills" && options.noSkills) throw new Error("service skills is not mounted");
      if (name === "settings") return settings;
      if (name === "skills") return skills;
      if (name === "loader") return loader;
      if (name === "llm") return options.llm;
      if (name === "attachments") return options.attachments;
      if (name === "workspaceRegistry") return options.workspaceRegistry;
      if (name === "sessionPersistence") return options.sessionPersistence;
      if (name === "sessions") return options.sessions;
      if (name === "webServer") return options.noWebServer ? undefined : webServer;
      if (name === "commands") return options.commands;
      return undefined;
    }),
    inject: vi.fn((_names: string[], callback: (child: unknown) => void) => {
      if (options.deferInject) {
        pendingInject.push(callback);
        return {};
      }
      // cordis hands the callback a scoped child whose injected services are
      // directly readable; the plugin body only reads sctx.settings here.
      callback({ settings });
      return {};
    }),
    effect: vi.fn((fn: () => unknown, _label?: string) => {
      const dispose = typeof fn === "function" ? fn() : undefined;
      if (typeof dispose === "function") disposers.push(dispose as () => void);
      return dispose;
    }),
    on: vi.fn((event: string) => {
      registrations.events.push(event);
      return () => {};
    }),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    tools: {
      get: vi.fn(() => undefined),
      register: vi.fn(() => () => {})
    },
    webServer
  };
  return { ctx, settings, skills, disposers, registrations, pendingInject };
}

/** A temp profile directory fixture for rescue-mode wiring tests. */
function rescueProfile(options: { patch: string; state?: string; manifest?: string }) {
  const dir = mkdtempSync(join(tmpdir(), "dsh-rescue-"));
  writeFileSync(join(dir, "cordis.patch.yml"), options.patch);
  if (options.state !== undefined) writeFileSync(join(dir, ".dsh-rescue.json"), options.state);
  writeFileSync(join(dir, "package.json"), options.manifest ?? JSON.stringify({
    name: "dsh-profile-test",
    private: true,
    dsh: { profile: { bundles: [] } }
  }));
  return dir;
}

/** The rescue state file of a temp profile dir, parsed. */
function rescueStateOf(dir: string) {
  return JSON.parse(readFileSync(join(dir, ".dsh-rescue.json"), "utf8"));
}

/** The rescue patch file of a temp profile dir, raw. */
function rescuePatchOf(dir: string) {
  return readFileSync(join(dir, "cordis.patch.yml"), "utf8");
}

/** Whether the patch block of one loader row carries `disabled: true`. */
function rowDisabled(raw: string, id: string) {
  for (const block of raw.split("\n- ")) {
    if (block.split("\n").some((line) => line === `id: ${id}`)) return block.includes("disabled: true");
  }
  return false;
}

/** Run every apply()-registered disposer (clears the rescue settle timers). */
function disposeAll(disposers: Array<() => void>) {
  for (const dispose of disposers) dispose();
}

/** A previous-boot-crashed state file (phase idle, boot never settled). */
function crashedState(pid = 1234) {
  return JSON.stringify({
    version: 1,
    phase: "idle",
    failure: null,
    plugins: [],
    appliedAt: null,
    boot: { pid, startedAt: 1, healthy: false, healthyAt: null }
  });
}

/** A previous-boot-healthy state file. */
function healthyState(pid = 1234) {
  return JSON.stringify({
    version: 1,
    phase: "idle",
    failure: null,
    plugins: [],
    appliedAt: null,
    boot: { pid, startedAt: 1, healthy: true, healthyAt: 2 }
  });
}

function fakeRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function fakeReq(method: string, url: string, remoteAddress: string) {
  return { method, url, socket: { remoteAddress } };
}

function fakeReqWithBody(method: string, url: string, payload: unknown) {
  const req = fakeReq(method, url, "127.0.0.1") as ReturnType<typeof fakeReq> & {
    on: (event: string, cb: (chunk?: Buffer) => void) => void;
  };
  req.on = (event, cb) => {
    if (event === "data") cb(Buffer.from(JSON.stringify(payload)));
    if (event === "end") cb();
  };
  return req;
}

describe("apply() wiring", () => {
  it("exposes the documented entry points", () => {
    expect(typeof apply).toBe("function");
    expect(NAME).toBe("better-deepseek-harness");
    expect(typeof SETTINGS_NS).toBe("string");
    expect(inject).toEqual(["tools"]);
    expect(typeof __setRescueHostHooks).toBe("function");
  });

  it("registers the API route, settings namespace, skill provider, and waterfalls", () => {
    const { ctx, settings, skills, registrations } = mockCtx();
    expect(() => apply(ctx, {})).not.toThrow();

    expect(ctx.webServer.register).toHaveBeenCalledTimes(1);
    const route = registrations.routes[0];
    expect(route?.path).toBe("/ext/api");
    expect(typeof route?.handler).toBe("function");

    expect(settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
    expect(skills.registerProvider).toHaveBeenCalledTimes(1);
    expect(registrations.events).toContain("tools/execute");
    expect(registrations.events).toContain("llm/stream");
  });

  it("registers the settings namespace once the settings service is available", () => {
    // The settings provider may start after this plugin: a one-shot
    // ctx.get("settings") at apply() time returns undefined in that order,
    // so the registration must ride ctx.inject and wait for the service.
    const { ctx, settings, pendingInject } = mockCtx({ deferInject: true });
    apply(ctx, {});
    expect(settings.register).not.toHaveBeenCalled();
    // The github tools register by default and ride the same deferred-fiber
    // pattern for their system-prompt section.
    const injectNames = ctx.inject.mock.calls.map((call) => call[0] as string[]);
    expect(injectNames).toContainEqual(["systemPrompt"]);
    const settingsIndex = injectNames.findIndex((names) => names.includes("settings"));
    expect(settingsIndex).toBeGreaterThanOrEqual(0);
    expect(pendingInject).toHaveLength(2);
    // the settings service comes up later; the deferred fiber then registers
    const child = { settings: { register: vi.fn(() => () => {}) }, logger: ctx.logger };
    pendingInject[settingsIndex](child);
    expect(child.settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
  });

  it("registers the settings namespace when settings is available at apply time", () => {
    const { ctx, settings } = mockCtx();
    apply(ctx, {});
    expect(settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
  });

  it("loads without a webServer service (headless/TUI host) and skips the API routes", () => {
    // dsh-TUI-style compositions mount no webServer; the plugin must still
    // load so the rescue watchdog, settings, skills, Tavily and tool repair
    // keep working, and only the /ext/api routes go missing.
    const { ctx, settings, skills, registrations } = mockCtx({ noWebServer: true });
    expect(() => apply(ctx, {})).not.toThrow();
    expect(registrations.routes).toHaveLength(0);
    expect(settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
    expect(skills.registerProvider).toHaveBeenCalledTimes(1);
    expect(registrations.events).toContain("tools/execute");
  });

  it("registers the /rescue command when the command registry is mounted", () => {
    const registered: Array<{ name: string; handler: (invocation: { rawInput: string }) => unknown }> = [];
    const commands = { register: vi.fn((definition: { name: string; handler: (invocation: { rawInput: string }) => unknown }) => {
      registered.push(definition);
      return () => {};
    }) };
    const { ctx, disposers } = mockCtx({ commands });
    expect(() => apply(ctx, {})).not.toThrow();
    expect(commands.register).toHaveBeenCalledTimes(1);
    expect(registered[0]?.name).toBe("rescue");
    expect(typeof registered[0]?.handler).toBe("function");
    disposeAll(disposers);
  });

  it("/rescue status reports idle when no rescue state exists", async () => {
    const registered: Array<{ name: string; handler: (invocation: { rawInput: string }) => unknown }> = [];
    const commands = { register: vi.fn((definition: { name: string; handler: (invocation: { rawInput: string }) => unknown }) => {
      registered.push(definition);
      return () => {};
    }) };
    const { ctx, disposers } = mockCtx({ commands });
    apply(ctx, {});
    const result = await registered[0]!.handler({ rawInput: "status" });
    expect(result).toMatchObject({ kind: "success" });
    expect(String((result as { text: string }).text)).toContain("idle");
    disposeAll(disposers);
  });

  it("/rescue apply restores the selected plugins from an applied rescue state", async () => {
    __setRescueHostHooks({ pid: 9999, isDesktop: true });
    const dir = rescueProfile({
      patch: [
        "- insert:",
        "    - id: ext-center",
        "      name: better-deepseek-harness",
        "    - id: boom-plugin",
        "      name: boom-plugin",
        "      disabled: true",
        "- id: another-off",
        "  name: another-off",
        "  disabled: true"
      ].join("\n"),
      state: JSON.stringify({
        version: 1,
        phase: "applied",
        failure: { kind: "fiber-failed", message: "boom" },
        plugins: [
          { name: "boom-plugin", kind: "patch", reason: { code: "load-failed" }, id: "boom-plugin", rowIds: ["boom-plugin"] },
          { name: "another-off", kind: "patch", reason: { code: "crash" }, id: "another-off", rowIds: ["another-off"] }
        ],
        appliedAt: "2026-08-15T00:00:00.000Z",
        boot: { pid: 1, startedAt: 1, healthy: true, healthyAt: 2 }
      })
    });
    try {
      const registered: Array<{ name: string; handler: (invocation: { rawInput: string }) => unknown }> = [];
      const commands = { register: vi.fn((definition: { name: string; handler: (invocation: { rawInput: string }) => unknown }) => {
        registered.push(definition);
        return () => {};
      }) };
      const { ctx, disposers } = mockCtx({ commands, baseUrl: pathToFileURL(join(dir, "cordis.patch.yml")).href });
      apply(ctx, {});
      const result = await registered[0]!.handler({ rawInput: "apply boom-plugin" });
      expect(result).toMatchObject({ kind: "success" });
      const text = String((result as { text: string }).text);
      expect(text).toContain("boom-plugin");
      expect(text).toContain("其余 1 个保持禁用");
      const patch = rescuePatchOf(dir);
      expect(rowDisabled(patch, "boom-plugin")).toBe(false);
      expect(rowDisabled(patch, "another-off")).toBe(true);
      disposeAll(disposers);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null, isDesktop: null });
    }
  });


  it("fails loud on an invalid config block", () => {
    const { ctx } = mockCtx();
    expect(() => apply(ctx, { tree: { maxEntries: 0 } })).toThrow(/invalid config/);
    expect(() => apply(ctx, { terminal: { maxSessions: 99 } })).toThrow(/invalid config/);
  });
});

describe("llm/stream image transcription wrapper", () => {
  /** Capture the registered llm/stream listener from a fresh apply(). */
  function captureListener(options: MockOptions = {}) {
    const { ctx } = mockCtx(options);
    apply(ctx, {});
    const call = (ctx.on as ReturnType<typeof vi.fn>).mock.calls.find((args: unknown[]) => args[0] === "llm/stream");
    if (!call) throw new Error("llm/stream listener was not registered");
    return call[1] as (options: unknown, next: () => unknown) => unknown;
  }

  function streamOf(chunks: unknown[]): AsyncIterable<unknown> {
    return (async function* () {
      for (const chunk of chunks) yield chunk;
    })();
  }

  it("returns an async iterable (never a Promise) and transcribes image requests", async () => {
    // The waterfall contract: the outermost return value must be an async
    // iterable — dsh-agent-loop consumes it with for-await and sibling
    // middleware with yield* next(); a Promise breaks every session.
    const calls: unknown[][] = [];
    const llm = {
      stream: vi.fn((options: unknown) => {
        calls.push(options as unknown[]);
        return streamOf([{ type: "text-delta", text: "一张猫的图片" }, { type: "finish", reason: { kind: "ok" } }]);
      })
    };
    const listener = captureListener({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm
    });
    const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const result = listener(
      { provider: "main", model: "m", messages: [{ role: "user", content: [{ type: "image", attachment: { kind: "data" } }] }] },
      next
    );
    // not a Promise — an async iterable
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator]).toBe("function");
    const chunks: unknown[] = [];
    for await (const chunk of result as AsyncIterable<unknown>) chunks.push(chunk);
    // vision call + rewritten main call
    expect(calls).toHaveLength(2);
    expect(llm.stream).toHaveBeenCalledTimes(2);
    // the rewritten main request has no image blocks
    const rewritten = calls[1] as unknown as {
      messages: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    const content = rewritten.messages[0].content;
    expect(content.some((block) => block.type === "image")).toBe(false);
    expect(content.some((block) => block.type === "text" && block.text?.includes("一张猫的图片"))).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("transcribes through a user-supplied custom vision endpoint", async () => {
    const calls: unknown[][] = [];
    const llm = {
      stream: vi.fn((options: unknown) => {
        calls.push(options as unknown[]);
        return streamOf([{ type: "finish", reason: { kind: "ok" } }]);
      })
    };
    const readImage = vi.fn(async () => ({ ref: { mediaType: "image/png" }, data: new Uint8Array([1, 2, 3]) }));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "一张自定义路由的图片" } }] })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const listener = captureListener({
        stored: {
          vision: {
            enabled: true,
            provider: "custom",
            model: "custom-vlm",
            apiUrl: "http://vision.test/v1/chat/completions",
            apiKey: "sk-test-123",
            maxTokens: 2048
          }
        },
        llm,
        attachments: { readImage }
      });
      const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
      const result = listener(
        { provider: "main", model: "m", messages: [{ role: "user", content: [{ type: "image", attachment: { attachmentId: "a1" } }] }] },
        next
      );
      for await (const chunk of result as AsyncIterable<unknown>) void chunk;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("http://vision.test/v1/chat/completions");
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string>; body: string };
      expect(init.headers.authorization).toBe("Bearer sk-test-123");
      expect(JSON.parse(init.body).max_tokens).toBe(2048);
      const rewritten = calls[0] as unknown as {
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };
      expect(rewritten.messages[0].content.some((block) => block.type === "text" && block.text?.includes("一张自定义路由的图片"))).toBe(true);
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to the reasoning field when the custom endpoint returns empty content", async () => {
    // Reasoning models (e.g. step-3.7-flash) can answer entirely in
    // message.reasoning while content stays "" — the transcription must use
    // that text instead of reporting failure.
    const llm = {
      stream: vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]))
    };
    const readImage = vi.fn(async () => ({ ref: { mediaType: "image/png" }, data: new Uint8Array([1, 2, 3]) }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { role: "assistant", content: "", reasoning: "这是一张网页截图，主题是悼湖茶馆。顶部导航栏有首页、归档、关于。" } }] })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const listener = captureListener({
        stored: { vision: { enabled: true, provider: "custom", model: "custom-vlm", apiUrl: "http://vision.test/v1/chat/completions" } },
        llm,
        attachments: { readImage }
      });
      const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
      const result = listener(
        { provider: "main", model: "m", messages: [{ role: "user", content: [{ type: "image", attachment: { attachmentId: "a1" } }] }] },
        next
      );
      for await (const _chunk of result as AsyncIterable<unknown>) void _chunk;
      const rewritten = (llm.stream as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };
      const text = rewritten.messages[0].content.find((b) => b.type === "text")?.text ?? "";
      expect(text).toContain("悼湖茶馆");
      expect(text).toContain("顶部导航栏");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("forwards next() untouched when transcription is disabled or the route matches", async () => {
    const listener = captureListener({}); // stored = {} -> vision disabled
    const downstream = streamOf([{ type: "finish", reason: { kind: "ok" } }]);
    const next = vi.fn(() => downstream);
    const result = listener(
      { provider: "main", model: "m", messages: [{ role: "user", content: [{ type: "image", attachment: {} }] }] },
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(result).toBe(downstream);
  });

  it("forwards next() when no llm service is reachable", async () => {
    const listener = captureListener({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } }
      // no llm -> ctx.get("llm") is undefined
    });
    const downstream = streamOf([{ type: "finish", reason: { kind: "ok" } }]);
    const next = vi.fn(() => downstream);
    const result = listener(
      { provider: "main", model: "m", messages: [{ role: "user", content: [{ type: "image", attachment: {} }] }] },
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(result).toBe(downstream);
  });
});

describe("vision capability bridge", () => {
  /** The patched llm.resolveModelInfo installed by apply() when llm is mounted. */
  function bridgeOf(options: MockOptions = {}) {
    const { ctx, disposers } = mockCtx(options);
    const llm = options.llm;
    if (!llm || typeof llm.resolveModelInfo !== "function") throw new Error("test requires llm.resolveModelInfo");
    // Capture the original before apply() swaps in the bridge wrapper.
    const original = llm.resolveModelInfo;
    apply(ctx, {});
    return { llm, disposers, original };
  }

  it("advertises image input when transcription is enabled", async () => {
    const { llm } = bridgeOf({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("deepseek", "deepseek-v4-flash");
    expect(info).toEqual({ inputModalities: ["text", "image"] });
  });

  it("keeps the model info untouched when transcription is disabled", async () => {
    const { llm } = bridgeOf({
      // stored = {} -> vision disabled
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("deepseek", "deepseek-v4-flash");
    expect(info).toEqual({ inputModalities: ["text"] });
  });

  it("does not duplicate image when the model already supports it", async () => {
    const { llm } = bridgeOf({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["image", "text"] }))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("vp", "vm");
    expect(info).toEqual({ inputModalities: ["image", "text"] });
  });

  it("does not advertise image input while the vision route is incomplete", async () => {
    // enabled but no provider/model means transcription would pass the image
    // through untouched — the gateway must keep rejecting it in that case.
    const { llm } = bridgeOf({
      stored: { vision: { enabled: true, provider: "", model: "" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("deepseek", "deepseek-v4-flash");
    expect(info).toEqual({ inputModalities: ["text"] });
  });

  it("does not advertise image input for the vision route itself", async () => {
    const { llm } = bridgeOf({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("vp", "vm");
    expect(info).toEqual({ inputModalities: ["text"] });
  });

  it("leaves absent inputModalities untouched (api-gateway admits those)", async () => {
    const { llm } = bridgeOf({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({}))
      }
    });
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("vp", "vm");
    expect(info).toEqual({});
  });

  it("restores the original resolveModelInfo when the plugin disposes", async () => {
    const { llm, disposers, original } = bridgeOf({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: {
        stream: vi.fn(),
        resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
      }
    });
    expect(llm.resolveModelInfo).not.toBe(original);
    for (const dispose of disposers) dispose();
    expect(llm.resolveModelInfo).toBe(original);
  });
});

describe("dsh-web-ui compatibility gate (host)", () => {
  /** The loader entry view of an ACTIVE dsh-web-ui family plugin. */
  function familyEntry(id: string, name: string, fiberState = 2) {
    return { id, options: { name }, fiber: { state: fiberState } };
  }

  /** Capture the registered llm/stream listener from a fresh apply(). */
  function captureListener(options: MockOptions = {}) {
    const { ctx } = mockCtx(options);
    apply(ctx, {});
    const call = (ctx.on as ReturnType<typeof vi.fn>).mock.calls.find((args: unknown[]) => args[0] === "llm/stream");
    if (!call) throw new Error("llm/stream listener was not registered");
    return call[1] as (options: unknown, next: () => unknown) => unknown;
  }

  function streamOf(chunks: unknown[]): AsyncIterable<unknown> {
    return (async function* () {
      for (const chunk of chunks) yield chunk;
    })();
  }

  const IMAGE_REQUEST = {
    provider: "main",
    model: "m",
    messages: [{ role: "user", content: [{ type: "image", attachment: { kind: "data" } }] }]
  };

  it("passes image requests through untouched while describe-image is ACTIVE", async () => {
    const stream = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const listener = captureListener({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: { stream },
      loaderEntries: [familyEntry("describe-image", "@linxin666/dsh-tool-describe-image")]
    });
    const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const result = listener(IMAGE_REQUEST, next) as AsyncIterable<unknown>;
    const chunks: unknown[] = [];
    for await (const chunk of result) chunks.push(chunk);
    // describe-image owns image understanding: no transcription call at all.
    expect(stream).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("keeps the capability bridge inert while describe-image is ACTIVE", async () => {
    const llm = {
      stream: vi.fn(),
      resolveModelInfo: vi.fn(async () => ({ inputModalities: ["text"] }))
    };
    const { ctx } = mockCtx({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm,
      loaderEntries: [familyEntry("describe-image", "@linxin666/dsh-tool-describe-image")]
    });
    apply(ctx, {});
    const info = await (llm.resolveModelInfo as ReturnType<typeof vi.fn>)("deepseek", "deepseek-v4-flash");
    // the api-gateway's original modality check stays in charge
    expect(info).toEqual({ inputModalities: ["text"] });
  });

  it("keeps transcribing while describe-image is still pending (fail-open)", async () => {
    const stream = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const listener = captureListener({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: { stream },
      loaderEntries: [familyEntry("describe-image", "@linxin666/dsh-tool-describe-image", 0)]
    });
    const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const result = listener(IMAGE_REQUEST, next) as AsyncIterable<unknown>;
    for await (const _chunk of result) { /* drain */ }
    expect(stream).toHaveBeenCalledTimes(2); // vision call + rewritten main call
    expect(next).not.toHaveBeenCalled();
  });

  it("other family members do not suppress image understanding", async () => {
    const stream = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const listener = captureListener({
      stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
      llm: { stream },
      loaderEntries: [
        familyEntry("ui-dsh-aionui-panel", "@linxin666/dsh-client-ui-aionui-panel"),
        familyEntry("ui-git-graph", "@linxin666/dsh-client-ui-git-graph"),
        familyEntry("ssh", "@linxin666/dsh-ssh")
      ]
    });
    const next = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
    const result = listener(IMAGE_REQUEST, next) as AsyncIterable<unknown>;
    for await (const _chunk of result) { /* drain */ }
    expect(stream).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
  });

  it("turns suppression on once the loader tree settles", async () => {
    vi.useFakeTimers();
    try {
      const entries: NonNullable<MockOptions["loaderEntries"]> = [
        familyEntry("describe-image", "@linxin666/dsh-tool-describe-image", 0) // pending at apply()
      ];
      const stream = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
      const { ctx } = mockCtx({
        stored: { vision: { enabled: true, provider: "vp", model: "vm" } },
        llm: { stream },
        loaderEntries: entries
      });
      apply(ctx, {});
      const call = (ctx.on as ReturnType<typeof vi.fn>).mock.calls.find((args: unknown[]) => args[0] === "llm/stream");
      if (!call) throw new Error("llm/stream listener was not registered");
      const listener = call[1] as (options: unknown, next: () => unknown) => unknown;

      // while describe-image is pending we keep transcribing
      const nextBefore = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
      const resultBefore = listener(IMAGE_REQUEST, nextBefore) as AsyncIterable<unknown>;
      for await (const _chunk of resultBefore) { /* drain */ }
      expect(stream).toHaveBeenCalledTimes(2);

      // the family settles ACTIVE; the gate refresh kicks in on the next poll
      entries[0]!.fiber = { state: 2 };
      await vi.advanceTimersByTimeAsync(500);

      const nextAfter = vi.fn(() => streamOf([{ type: "finish", reason: { kind: "ok" } }]));
      const resultAfter = listener(IMAGE_REQUEST, nextAfter) as AsyncIterable<unknown>;
      for await (const _chunk of resultAfter) { /* drain */ }
      expect(stream).toHaveBeenCalledTimes(2); // no new transcription calls
      expect(nextAfter).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("route dispatcher", () => {
  async function mountedHandler() {
    const { ctx } = mockCtx();
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
  }

  it("serves /ext/api/state with a well-formed envelope", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "127.0.0.1"), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    expect(body.value.name).toBe(NAME);
    expect(Array.isArray(body.value.skills)).toBe(true);
    expect(body.value.plugins).toBeTruthy();
  });

  it("sends the configured vision maxImagesCap through /ext/api/state limits", async () => {
    const { ctx } = mockCtx();
    apply(ctx, { vision: { maxImagesCap: 5 } });
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "127.0.0.1"), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.value.limits.visionMaxImagesCap).toBe(5);
  });

  it("keeps /ext/api/state loopback-only like the other readers", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "10.0.0.5"), res);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
  });

  it("rejects unknown paths with 404", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/nope", "127.0.0.1"), res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
  });

  it("rejects non-loopback access to loopback-only routes", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/tree", "10.0.0.5"), res);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("rejects a wrong HTTP method with 405", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("POST", "/ext/api/state", "127.0.0.1"), res);
    expect(res.writeHead).toHaveBeenCalledWith(405, expect.anything());
  });

  it("rejects a malformed percent-encoded path with 400", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/%E0%A4%A", "127.0.0.1"), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });

  it("rejects a non-object JSON body with a clear bad-request", async () => {
    const handler = await mountedHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", null), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });
});

describe("input optimize route", () => {
  async function mountedOptimizeHandler(llm?: { stream: (options: unknown) => AsyncIterable<unknown> }) {
    const { ctx } = mockCtx({ llm });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
  }

  it("calls the current model and returns optimized text", async () => {
    const llm = {
      stream: vi.fn(() => (async function* () {
        yield { type: "text-delta", text: "优化后的输入" };
        yield { type: "finish", reason: { kind: "stop" } };
      })())
    };
    const handler = await mountedOptimizeHandler(llm);
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/input/optimize", {
      text: "  帮我 优化 这段 输入  ",
      provider: "deepseek",
      model: "deepseek-v4",
      sessionId: "s1",
      reasoningEffort: "high"
    }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    expect(body.value.text).toBe("优化后的输入");
    expect(llm.stream).toHaveBeenCalledTimes(1);
    const request = (llm.stream.mock.calls[0] as unknown[])[0] as {
      provider: string;
      model: string;
      reasoningEffort?: string;
      system: string;
      messages: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    expect(request.provider).toBe("deepseek");
    expect(request.model).toBe("deepseek-v4");
    expect(request.reasoningEffort).toBe("high");
    expect(request.system).toContain("optimizer");
    expect(request.messages[0].content[0].text).toContain("帮我");
  });

  it("rejects when the current model is not known", async () => {
    const handler = await mountedOptimizeHandler({ stream: vi.fn() });
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/input/optimize", { text: "hello" }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });

  it("surfaces provider stream failures instead of reporting an empty optimization", async () => {
    const llm = {
      stream: vi.fn(() => (async function* () {
        yield { type: "finish", reason: { kind: "error", failure: { code: "AUTH", message: "invalid api key" } } };
      })())
    };
    const handler = await mountedOptimizeHandler(llm);
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/input/optimize", {
      text: "optimize me",
      provider: "deepseek",
      model: "deepseek-v4"
    }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("llm-failed");
    expect(body.error.message).toContain("invalid api key");
  });
});

describe("archive delete route", () => {
  async function mountedArchiveHandler(options: MockOptions = {}) {
    const { ctx } = mockCtx(options);
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
  }

  it("deletes archived sessions and detaches them from workspaces", async () => {
    const workspace = {
      sessionIds: ["a"],
      detachSession: vi.fn(async () => {})
    };
    const registry = {
      archivedSessionIds: ["a", "b"],
      list: vi.fn(() => [workspace])
    };
    const persistence = {
      list: vi.fn(async () => [{ id: "a" }, { id: "b" }]),
      locate: vi.fn((header: { id: string }) => ({ path: join("sessions", header.id, "session.jsonl.zstd") }))
    };
    const sessions = { get: vi.fn(() => undefined) };
    const handler = await mountedArchiveHandler({ workspaceRegistry: registry, sessionPersistence: persistence, sessions });
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/archive/delete", { ids: ["a", "b"] }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    expect(body.value).toEqual({ deleted: ["a", "b"], skipped: [], count: 2 });
    expect(workspace.detachSession).toHaveBeenCalledWith("a");
    expect(workspace.detachSession).not.toHaveBeenCalledWith("b");
    expect(persistence.locate).toHaveBeenCalledTimes(2);
  });

  it("rejects ids that are not in the archive set", async () => {
    const registry = { archivedSessionIds: ["a"], list: vi.fn(() => []) };
    const handler = await mountedArchiveHandler({ workspaceRegistry: registry });
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/archive/delete", { ids: ["x"] }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("archive-not-found");
  });

  it("skips live (attached) archived sessions instead of deleting them", async () => {
    const workspace = { sessionIds: ["a"], detachSession: vi.fn(async () => {}) };
    const registry = { archivedSessionIds: ["a"], list: vi.fn(() => [workspace]) };
    const persistence = {
      list: vi.fn(async () => [{ id: "a" }]),
      locate: vi.fn((header: { id: string }) => ({ path: join("sessions", header.id, "session.jsonl.zstd") }))
    };
    const sessions = { get: vi.fn(() => ({ id: "a" })) };
    const handler = await mountedArchiveHandler({ workspaceRegistry: registry, sessionPersistence: persistence, sessions });
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/archive/delete", { ids: ["a"] }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    expect(body.value).toEqual({ deleted: [], skipped: ["a"], count: 0 });
    expect(workspace.detachSession).not.toHaveBeenCalled();
  });
});

describe("config route", () => {
  async function mountedConfigHandler() {
    const { ctx, settings } = mockCtx();
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return {
      settings,
      handler: register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>
    };
  }

  it("writes settings patches through the plugin settings service", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    const vision = { enabled: true, provider: "vp", model: "vm", prompt: "", maxImages: 4 };
    await handler(fakeReqWithBody("POST", "/ext/api/config", { vision }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{ op: "set", path: ["vision"], value: vision }]);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    expect(body.value.settingsWritable).toBe(true);
  });

  it("clears settings fields through path unset ops", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { reset: ["vision"] }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{ op: "unset", path: ["vision"] }]);
  });

  it("reports settings-unavailable (not internal) when the settings service is not mounted", async () => {
    const { ctx } = mockCtx({ noSettings: true });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { allowLan: true }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("settings-unavailable");
  });

  it("still succeeds when the skills service is missing after a settings write", async () => {
    // A successful write must not turn into an error response just because
    // the follow-up cache invalidation cannot reach an optional service.
    const { settings, ctx } = mockCtx({ noSkills: true });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { allowLan: true }), res);
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{ op: "set", path: ["allowLan"], value: true }]);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
  });

  it("stores a trimmed vision apiKey from the client", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      vision: { enabled: true, provider: "custom", model: "vm", apiUrl: "http://x.test", apiKey: "  sk-123  " }
    }), res);
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{
      op: "set",
      path: ["vision"],
      value: { enabled: true, provider: "custom", model: "vm", apiUrl: "http://x.test", apiKey: "sk-123" }
    }]);
    expect(JSON.parse(res.end.mock.calls[0][0]).ok).toBe(true);
  });

  it("drops a blank apiKey so the stored key is kept", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      vision: { enabled: true, provider: "custom", model: "vm", apiUrl: "http://x.test", apiKey: "   " }
    }), res);
    const ops = settings.mutate.mock.calls[0][1] as Array<{ value: Record<string, unknown> }>;
    expect(ops[0].value).not.toHaveProperty("apiKey");
    expect(JSON.parse(res.end.mock.calls[0][0]).ok).toBe(true);
  });

  it("rejects an apiKey with control bytes", async () => {
    const { handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      vision: { enabled: true, provider: "custom", apiKey: "sk-\0-bad" }
    }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });

  it("stores a vision maxTokens user override", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      vision: { enabled: true, provider: "custom", model: "vm", apiUrl: "http://x.test", maxTokens: 2048 }
    }), res);
    const ops = settings.mutate.mock.calls[0][1] as Array<{ value: Record<string, unknown> }>;
    expect(ops[0].value.maxTokens).toBe(2048);
    expect(JSON.parse(res.end.mock.calls[0][0]).ok).toBe(true);
  });

  it("rejects a vision maxTokens outside 64-8192", async () => {
    const { handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      vision: { enabled: true, provider: "custom", maxTokens: 9000 }
    }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });

  it("rejects a vision maxImages outside the deployment cap", async () => {
    const { ctx, settings } = mockCtx();
    apply(ctx, { vision: { maxImagesCap: 4 } });
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { vision: { maxImages: 8 } }), res);
    expect(settings.mutate).not.toHaveBeenCalled();
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
    expect(body.error.message).toContain("1 and 4");
  });

  it("merges a partial vision patch with the stored section so the apiKey survives", async () => {
    const { ctx, settings } = mockCtx({
      stored: { vision: { enabled: true, provider: "vp", model: "vm", apiKey: "sk-secret" } }
    });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { vision: { enabled: false } }), res);
    const ops = settings.mutate.mock.calls[0][1] as Array<{ value: Record<string, unknown> }>;
    expect(ops[0].value).toEqual({ enabled: false, provider: "vp", model: "vm", apiKey: "sk-secret" });
  });

  it("never echoes the stored apiKey back through /ext/api/state", async () => {
    const { ctx } = mockCtx({ stored: { vision: { enabled: true, provider: "custom", apiKey: "secret-123", apiUrl: "http://x.test" } } });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "127.0.0.1"), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    const vision = body.value.config.vision as Record<string, unknown>;
    expect(vision).not.toHaveProperty("apiKey");
    expect(vision.apiKeyConfigured).toBe(true);
  });
});

describe("tavily search tool", () => {
  /** The tavily_search definition registered by apply() (or undefined). */
  function registeredTool(options: MockOptions = {}) {
    const { ctx } = mockCtx(options);
    apply(ctx, {});
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const call = register.mock.calls.find((entry) => (entry[0] as { name?: string }).name === "tavily_search");
    if (call === undefined) return undefined;
    return call[0] as {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, { type: string }>;
        required?: string[];
      };
      output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => unknown[] };
      execute: (args: { query: string }, exec: { signal: AbortSignal }) => Promise<Record<string, unknown>>;
    };
  }

  it("registers tavily_search when ext-center.tavily.enabled is true", () => {
    const tool = registeredTool({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
    expect(tool).toBeTruthy();
    expect(tool!.name).toBe("tavily_search");
    expect(tool!.description).toContain("Tavily");
    expect(tool!.parameters.type).toBe("object");
    expect(tool!.parameters.properties.query?.type).toBe("string");
    expect(tool!.parameters.required).toContain("query");
    expect(tool!.output.schema.type).toBe("object");
    expect(typeof tool!.execute).toBe("function");
  });

  it("does not register tavily_search while the master switch is off", () => {
    const tool = registeredTool({ stored: { tavily: { enabled: false, apiKey: "tvly-" + "a".repeat(32) } } });
    expect(tool).toBeUndefined();
  });

  it("re-registers the tool after the master switch is toggled off and back on", () => {
    const { ctx, settings } = mockCtx({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const tavilyCalls = () => register.mock.calls.filter((call) => (call[0] as { name?: string }).name === "tavily_search");
    const firstDispose = vi.fn();
    register.mockReturnValueOnce(firstDispose);
    apply(ctx, {});
    expect(tavilyCalls()).toHaveLength(1);

    // apply() feeds the settings owner's watch callback into the Tavily sync.
    const owner = settings.register.mock.results[0].value as { watch: ReturnType<typeof vi.fn> };
    const onSettings = owner.watch.mock.calls[0][0] as (next: Record<string, unknown>) => void;

    onSettings({ tavily: { enabled: false, apiKey: "tvly-" + "a".repeat(32) } });
    expect(firstDispose).toHaveBeenCalledTimes(1);

    onSettings({ tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } });
    expect(tavilyCalls()).toHaveLength(2);
    expect(firstDispose).toHaveBeenCalledTimes(1);
  });

  it("disposes the registered tool when the plugin unloads", () => {
    const { ctx, disposers } = mockCtx({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const toolDisposers: Array<ReturnType<typeof vi.fn>> = [];
    register.mockImplementation(() => {
      const dispose = vi.fn();
      toolDisposers.push(dispose);
      return dispose;
    });
    apply(ctx, {});
    // The first registration is tavily_search (apply registers it before the
    // github tools); its disposer must run when the plugin unloads.
    const tavilyDispose = toolDisposers[0];
    for (const disposer of disposers) disposer();
    expect(tavilyDispose).toHaveBeenCalledTimes(1);
  });

  it("executes a Tavily search and maps the response", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        answer: "A summary.",
        results: [{ title: "A", url: "https://a.example", content: "snippet", score: 0.9 }]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = registeredTool({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
      const result = await tool!.execute({ query: "deepseek news" }, { signal: new AbortController().signal });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.tavily.com/search");
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string>; body: string };
      expect(init.headers.authorization).toBe("Bearer " + "tvly-" + "a".repeat(32));
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.query).toBe("deepseek news");
      expect(body.search_depth).toBe("basic");
      expect(body.max_results).toBe(5);
      expect(body.include_raw_content).toBe(false);
      expect(body.include_answer).toBe(true);
      expect(result).toEqual({
        content: "A summary.",
        sources: [{ url: "https://a.example", title: "A", snippet: "snippet" }],
        truncated: false
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes search depth and raw-content settings through to the API", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ results: [{ url: "https://a.example", raw_content: "<p>raw</p>" }] }) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = registeredTool({
        stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32), searchDepth: "advanced", maxResults: 3, includeRaw: true } }
      });
      const result = await tool!.execute({ query: "q" }, { signal: new AbortController().signal });
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
      expect(body.search_depth).toBe("advanced");
      expect(body.max_results).toBe(3);
      expect(body.include_raw_content).toBe(true);
      expect(result.sources).toEqual([{ url: "https://a.example", rawContent: "<p>raw</p>" }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails loudly (not blocking) when Tavily is disabled at execution time", async () => {
    // The tool is registered while enabled, then the master switch flips off
    // before the call — the execution-time gate must reject with a clear
    // message instead of searching.
    const stored = { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } };
    const tool = registeredTool({ stored });
    stored.tavily.enabled = false;
    await expect(tool!.execute({ query: "q" }, { signal: new AbortController().signal })).rejects.toThrow(/disabled/);
  });

  it("fails loudly when the API key is missing at execution time", async () => {
    const stored = { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } };
    const tool = registeredTool({ stored });
    stored.tavily.apiKey = "";
    await expect(tool!.execute({ query: "q" }, { signal: new AbortController().signal })).rejects.toThrow(/no API key/);
  });

  it("maps API errors to a clear message", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: false, status: 401, json: async () => ({ error: "invalid api key" }) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = registeredTool({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
      await expect(tool!.execute({ query: "q" }, { signal: new AbortController().signal })).rejects.toThrow(/HTTP 401/);
      await expect(tool!.execute({ query: "q" }, { signal: new AbortController().signal })).rejects.toThrow(/invalid api key/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("surfaces network failures instead of crashing", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => { throw new Error("ECONNREFUSED"); });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = registeredTool({ stored: { tavily: { enabled: true, apiKey: "tvly-" + "a".repeat(32) } } });
      await expect(tool!.execute({ query: "q" }, { signal: new AbortController().signal })).rejects.toThrow(/ECONNREFUSED/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("github api tools", () => {
  interface GithubTool {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, { type: string }>;
      required?: string[];
    };
    output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => unknown[] };
    execute: (args: Record<string, unknown>, exec: { signal: AbortSignal }) => Promise<Record<string, unknown>>;
  }

  /** The github_* definitions registered by apply(), keyed by name. */
  function githubTools(options: MockOptions = {}) {
    const { ctx } = mockCtx(options);
    apply(ctx, {});
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const tools: Record<string, GithubTool> = {};
    for (const call of register.mock.calls) {
      const tool = call[0] as GithubTool;
      if (typeof tool.name === "string" && tool.name.startsWith("github_")) tools[tool.name] = tool;
    }
    return tools;
  }

  const TOOL_NAMES = ["github_repo", "github_tree", "github_file", "github_search", "github_releases"];

  it("registers the five github tools by default (public repos need no token)", () => {
    const tools = githubTools();
    expect(Object.keys(tools).sort()).toEqual([...TOOL_NAMES].sort());
    for (const name of TOOL_NAMES) {
      const tool = tools[name];
      expect(tool.parameters.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
      expect(tool.output.schema.type).toBe("object");
    }
    expect(tools.github_repo.parameters.properties.repo.type).toBe("string");
    expect(tools.github_repo.parameters.required).toContain("repo");
    expect(tools.github_file.parameters.required).toContain("path");
    expect(tools.github_search.parameters.required).toContain("query");
  });

  it("does not register github tools while the master switch is off", () => {
    expect(githubTools({ stored: { github: { enabled: false } } })).toEqual({});
  });

  it("re-registers the tools after the master switch is toggled off and back on", () => {
    const { ctx, settings } = mockCtx({});
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const disposers: Array<ReturnType<typeof vi.fn>> = [];
    register.mockImplementation(() => {
      const dispose = vi.fn();
      disposers.push(dispose);
      return dispose;
    });
    apply(ctx, {});
    expect(register.mock.calls.filter((call) => String((call[0] as { name: string }).name).startsWith("github_"))).toHaveLength(5);

    const owner = settings.register.mock.results[0].value as { watch: ReturnType<typeof vi.fn> };
    const onSettings = owner.watch.mock.calls[0][0] as (next: Record<string, unknown>) => void;

    onSettings({ github: { enabled: false } });
    expect(disposers.filter((dispose) => dispose.mock.calls.length > 0).length).toBe(5);

    onSettings({ github: { enabled: true } });
    expect(register.mock.calls.filter((call) => String((call[0] as { name: string }).name).startsWith("github_"))).toHaveLength(10);
  });

  it("disposes the registered tools when the plugin unloads", () => {
    const { ctx, disposers } = mockCtx({});
    const register = ctx.tools.register as ReturnType<typeof vi.fn>;
    const dispose = vi.fn();
    register.mockReturnValue(dispose);
    apply(ctx, {});
    expect(register.mock.calls.filter((call) => String((call[0] as { name: string }).name).startsWith("github_"))).toHaveLength(5);
    for (const disposer of disposers) disposer();
    expect(dispose).toHaveBeenCalledTimes(5);
  });

  it("executes github_repo and maps the response without auth headers", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        full_name: "octocat/Hello-World",
        html_url: "https://github.com/octocat/Hello-World",
        description: "A repo",
        default_branch: "main",
        stargazers_count: 42,
        forks_count: 7,
        open_issues_count: 1,
        language: "Rust",
        license: { spdx_id: "MIT" },
        topics: ["demo"],
        pushed_at: "2026-01-01T00:00:00Z",
        archived: false
      })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = githubTools().github_repo;
      const result = await tool.execute({ repo: "octocat/Hello-World" }, { signal: new AbortController().signal });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/octocat/Hello-World");
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
      expect(init.headers.accept).toBe("application/vnd.github+json");
      expect(init.headers["x-github-api-version"]).toBe("2022-11-28");
      expect(init.headers).not.toHaveProperty("authorization");
      expect(result).toEqual({
        fullName: "octocat/Hello-World",
        htmlUrl: "https://github.com/octocat/Hello-World",
        description: "A repo",
        defaultBranch: "main",
        stars: 42,
        forks: 7,
        openIssues: 1,
        language: "Rust",
        license: "MIT",
        topics: ["demo"],
        pushedAt: "2026-01-01T00:00:00Z",
        archived: false
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends Bearer auth when a token is configured", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ full_name: "o/r" }) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = githubTools({ stored: { github: { token: "ghp_" + "a".repeat(36) } } }).github_repo;
      await tool.execute({ owner: "o", repo: "r" }, { signal: new AbortController().signal });
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
      expect(init.headers.authorization).toBe("Bearer " + "ghp_" + "a".repeat(36));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("executes github_file and decodes base64 content", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ name: "index.ts", path: "src/index.ts", size: 10, content: Buffer.from("console.log(1)\n").toString("base64") })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = githubTools().github_file;
      const result = await tool.execute({ repo: "o/r", path: "src/index.ts" }, { signal: new AbortController().signal });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/o/r/contents/src/index.ts");
      expect(result).toEqual({ content: "console.log(1)\n", size: 10, truncated: false, binary: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("guides the model when the contents endpoint returns the wrong kind", async () => {
    // github_tree against a file path (the API returns an object) must point
    // the model at github_file.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ name: "a.ts", path: "a.ts", type: "file", size: 3, content: "aGk=" })
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tree = githubTools().github_tree;
      await expect(tree.execute({ repo: "o/r", path: "a.ts" }, { signal: new AbortController().signal })).rejects.toThrow(/use github_file/);
    } finally {
      vi.unstubAllGlobals();
    }
    // github_file against a directory path (the API returns an array) must
    // point the model at github_tree.
    const fileFetch = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => [{ name: "a", path: "a", type: "file" }] }));
    vi.stubGlobal("fetch", fileFetch);
    try {
      const file = githubTools().github_file;
      await expect(file.execute({ repo: "o/r", path: "src" }, { signal: new AbortController().signal })).rejects.toThrow(/use github_tree/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps a 404 into a friendly not-found error", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: false, status: 404, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const tool = githubTools().github_repo;
      await expect(tool.execute({ repo: "no/such-repo" }, { signal: new AbortController().signal })).rejects.toThrow(/not found/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails loudly (not blocking) when GitHub is disabled at execution time", async () => {
    // The tool is registered while enabled, then the master switch flips off
    // before the call — the execution-time gate must reject with a clear
    // message instead of calling the API.
    const stored = { github: { enabled: true } };
    const tools = githubTools({ stored });
    stored.github.enabled = false;
    await expect(tools.github_repo.execute({ repo: "o/r" }, { signal: new AbortController().signal })).rejects.toThrow(/disabled/);
  });

  it("validates search and releases limits", async () => {
    const tools = githubTools();
    const search = tools.github_search;
    await expect(search.execute({ query: "q", limit: 0 }, { signal: new AbortController().signal })).rejects.toThrow(/limit/);
    await expect(search.execute({ query: "q", limit: 11 }, { signal: new AbortController().signal })).rejects.toThrow(/limit/);
    await expect(search.execute({ query: "" }, { signal: new AbortController().signal })).rejects.toThrow(/non-empty/);
    const releases = tools.github_releases;
    await expect(releases.execute({ repo: "o/r", limit: 3.5 }, { signal: new AbortController().signal })).rejects.toThrow(/limit/);
  });
});

describe("config route (tavily)", () => {
  async function mountedConfigHandler(stored: Record<string, unknown> = {}) {
    const { ctx, settings } = mockCtx({ stored });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return {
      settings,
      handler: register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>
    };
  }

  it("stores a validated tavily patch with the trimmed key", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      tavily: { enabled: true, searchDepth: "advanced", maxResults: 7, includeRaw: true, apiKey: "  tvly-" + "a".repeat(32) + "  " }
    }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{
      op: "set",
      path: ["tavily"],
      value: { enabled: true, searchDepth: "advanced", maxResults: 7, includeRaw: true, apiKey: "tvly-" + "a".repeat(32) }
    }]);
  });

  it("rejects an invalid search depth", async () => {
    const { handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { tavily: { searchDepth: "ultra" } }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
  });

  it("rejects maxResults outside 1-10", async () => {
    const { handler } = await mountedConfigHandler();
    for (const maxResults of [0, 11, 3.5]) {
      const res = fakeRes();
      await handler(fakeReqWithBody("POST", "/ext/api/config", { tavily: { maxResults } }), res);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("bad-request");
    }
  });

  it("rejects a malformed API key format", async () => {
    const { handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { tavily: { enabled: true, apiKey: "sk-not-tavily" } }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
    expect(body.error.message).toMatch(/tvly-/);
  });

  it("drops a blank apiKey so the stored key is kept", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { tavily: { enabled: true, apiKey: "   " } }), res);
    const ops = settings.mutate.mock.calls[0][1] as Array<{ value: Record<string, unknown> }>;
    expect(ops[0].value).not.toHaveProperty("apiKey");
    expect(JSON.parse(res.end.mock.calls[0][0]).ok).toBe(true);
  });

  it("resets the whole tavily section", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { reset: ["tavily"] }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{ op: "unset", path: ["tavily"] }]);
  });

  it("never echoes the stored tavily apiKey through /ext/api/state", async () => {
    const { ctx } = mockCtx({ stored: { tavily: { enabled: true, apiKey: "tvly-secret-1234567890" } } });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "127.0.0.1"), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    const tavily = body.value.config.tavily as Record<string, unknown>;
    expect(tavily).not.toHaveProperty("apiKey");
    expect(tavily.apiKeyConfigured).toBe(true);
  });
});

describe("config route (github)", () => {
  async function mountedConfigHandler(stored: Record<string, unknown> = {}) {
    const { ctx, settings } = mockCtx({ stored });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return {
      settings,
      handler: register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>
    };
  }

  it("stores a validated github patch with the trimmed token", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", {
      github: { enabled: true, timeoutMs: 45000, token: "  ghp_" + "a".repeat(36) + "  " }
    }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{
      op: "set",
      path: ["github"],
      value: { enabled: true, timeoutMs: 45000, token: "ghp_" + "a".repeat(36) }
    }]);
  });

  it("rejects a malformed token", async () => {
    const { handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { github: { enabled: true, token: "sk-not-github" } }), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad-request");
    expect(body.error.message).toMatch(/ghp_/);
  });

  it("rejects timeoutMs outside the accepted range", async () => {
    const { handler } = await mountedConfigHandler();
    for (const timeoutMs of [1000, 999999, 3.5]) {
      const res = fakeRes();
      await handler(fakeReqWithBody("POST", "/ext/api/config", { github: { timeoutMs } }), res);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("bad-request");
    }
  });

  it("drops a blank token so the stored token is kept", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { github: { enabled: true, token: "   " } }), res);
    const ops = settings.mutate.mock.calls[0][1] as Array<{ value: Record<string, unknown> }>;
    expect(ops[0].value).not.toHaveProperty("token");
    expect(JSON.parse(res.end.mock.calls[0][0]).ok).toBe(true);
  });

  it("resets the whole github section", async () => {
    const { settings, handler } = await mountedConfigHandler();
    const res = fakeRes();
    await handler(fakeReqWithBody("POST", "/ext/api/config", { reset: ["github"] }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(settings.mutate).toHaveBeenCalledWith(SETTINGS_NS, [{ op: "unset", path: ["github"] }]);
  });

  it("never echoes the stored github token through /ext/api/state", async () => {
    const { ctx } = mockCtx({ stored: { github: { enabled: true, token: "ghp-secret-1234567890" } } });
    apply(ctx, {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    const handler = register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>;
    const res = fakeRes();
    await handler(fakeReq("GET", "/ext/api/state", "127.0.0.1"), res);
    const body = JSON.parse(res.end.mock.calls[0][0]);
    expect(body.ok).toBe(true);
    const github = body.value.config.github as Record<string, unknown>;
    expect(github).not.toHaveProperty("token");
    expect(github.tokenConfigured).toBe(true);
  });
});

/* ─────────────────── git source build fallback ─────────────────── */

describe("packageEntryPoints", () => {
  it("reads the main field", () => {
    expect(packageEntryPoints({ main: "lib/index.js" })).toEqual(["lib/index.js"]);
  });

  it("reads a string exports entry", () => {
    expect(packageEntryPoints({ exports: { ".": "./lib/index.js" } })).toEqual(["./lib/index.js"]);
  });

  it("prefers import over require inside a condition object", () => {
    expect(packageEntryPoints({ exports: { ".": { require: "./lib/index.cjs", import: "./lib/index.js" } } })).toEqual(["./lib/index.js"]);
  });

  it("digs into a nested condition object", () => {
    expect(packageEntryPoints({ exports: { ".": { types: "./lib/index.d.ts", default: "./lib/index.js" } } })).toEqual(["./lib/index.js"]);
  });

  it("takes the first string of a fallback array", () => {
    expect(packageEntryPoints({ exports: { ".": ["./lib/index.js", "./index.js"] } })).toEqual(["./lib/index.js"]);
  });

  it("returns [] when nothing is declared", () => {
    expect(packageEntryPoints({ name: "x" })).toEqual([]);
  });
});

describe("packageEntryExists", () => {
  it("is true when any declared entry exists on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-ext-"));
    try {
      mkdirSync(join(dir, "lib"));
      writeFileSync(join(dir, "lib", "index.js"), "export {};\n");
      expect(packageEntryExists(dir, { main: "lib/index.js" })).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is false when every declared entry is missing (unbuilt repo)", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-ext-"));
    try {
      expect(packageEntryExists(dir, { main: "lib/index.js", exports: { ".": "./lib/index.js" } })).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is true when nothing is declared (loader decides)", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-ext-"));
    try {
      expect(packageEntryExists(dir, { name: "x" })).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ensureBuiltPackage", () => {
  type RunCall = { cmd: string; args: string[]; cwd: string };

  function fakeRunFactory(installCreatesEntry: boolean, buildCreatesEntry: boolean) {
    const calls: RunCall[] = [];
    let ran = 0;
    const run = async (cmd: string, args: string[], cwd: string) => {
      calls.push({ cmd, args, cwd });
      ran += 1;
      if (ran === 1 && installCreatesEntry) {
        mkdirSync(join(cwd, "lib"), { recursive: true });
        writeFileSync(join(cwd, "lib", "index.js"), "export {};\n");
      }
      if (ran === 2 && buildCreatesEntry) {
        mkdirSync(join(cwd, "lib"), { recursive: true });
        writeFileSync(join(cwd, "lib", "index.js"), "export {};\n");
      }
      return { stdout: "", stderr: "" };
    };
    return { calls, run };
  }

  function stagedPackage(scripts: Record<string, string> = {}) {
    const dir = mkdtempSync(join(tmpdir(), "dsh-ext-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", main: "lib/index.js", scripts }));
    return dir;
  }

  it("skips the build when the entry already exists", async () => {
    const dir = stagedPackage();
    try {
      mkdirSync(join(dir, "lib"), { recursive: true });
      writeFileSync(join(dir, "lib", "index.js"), "export {};\n");
      const { calls, run } = fakeRunFactory(false, false);
      expect(await ensureBuiltPackage(dir, { main: "lib/index.js" }, run)).toBe(false);
      expect(calls).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds from source when the repo ships no lib/", async () => {
    const dir = stagedPackage({ build: "tsc -p ." });
    try {
      const { calls, run } = fakeRunFactory(false, true);
      expect(await ensureBuiltPackage(dir, { main: "lib/index.js", scripts: { build: "tsc -p ." } }, run)).toBe(true);
      expect(calls.map((call) => call.args[0])).toEqual(["install", "run"]);
      expect(calls[0].args.slice(1)).toContain("--no-audit");
      expect(calls[1].args).toEqual(["run", "build"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips npm run build when install alone produces the entry (prepare hook)", async () => {
    const dir = stagedPackage({ build: "tsc -p ." });
    try {
      const { calls, run } = fakeRunFactory(true, false);
      expect(await ensureBuiltPackage(dir, { main: "lib/index.js", scripts: { build: "tsc -p ." } }, run)).toBe(true);
      expect(calls.map((call) => call.args[0])).toEqual(["install"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs npm run build when install alone does not produce the entry", async () => {
    const dir = stagedPackage({ build: "tsc -p ." });
    try {
      const { calls, run } = fakeRunFactory(false, true);
      expect(await ensureBuiltPackage(dir, { main: "lib/index.js", scripts: { build: "tsc -p ." } }, run)).toBe(true);
      expect(calls.map((call) => call.args[0])).toEqual(["install", "run"]);
      expect(calls[1].args).toEqual(["run", "build"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails loudly when no build script exists", async () => {
    const dir = stagedPackage();
    try {
      const { run } = fakeRunFactory(false, false);
      await expect(ensureBuiltPackage(dir, { main: "lib/index.js", scripts: {} }, run)).rejects.toMatchObject({
        code: "build-failed",
        message: expect.stringContaining("build")
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails loudly when the build still leaves the entry missing", async () => {
    const dir = stagedPackage({ build: "tsc -p ." });
    try {
      const { run } = fakeRunFactory(false, false);
      await expect(ensureBuiltPackage(dir, { main: "lib/index.js", scripts: { build: "tsc -p ." } }, run)).rejects.toMatchObject({
        code: "build-failed",
        message: expect.stringContaining("lib/index.js")
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps a missing npm executable to build-tool-missing", async () => {
    const dir = stagedPackage();
    try {
      const run = async () => { throw { code: "spawn", message: "spawn npm.cmd ENOENT", tail: "" }; };
      await expect(ensureBuiltPackage(dir, { main: "lib/index.js", scripts: {} }, run)).rejects.toMatchObject({
        code: "build-tool-missing"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports the npm output tail on a failed install", async () => {
    const dir = stagedPackage();
    try {
      const run = async () => { throw { code: "failed", message: "exited with code 1", tail: "npm error something broke" }; };
      await expect(ensureBuiltPackage(dir, { main: "lib/index.js", scripts: {} }, run)).rejects.toMatchObject({
        code: "build-failed",
        message: expect.stringContaining("npm error something broke")
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("materializePackage source metadata", () => {
  it("returns { manifest, builtFromSource } for a folder source", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-ext-"));
    try {
      const pkgDir = join(root, "pkg");
      mkdirSync(pkgDir);
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", main: "index.js" }));
      writeFileSync(join(pkgDir, "index.js"), "export {};\n");
      // staging must live OUTSIDE the package dir (cpSync rejects copying a dir into itself)
      const staging = join(root, "staging");
      const result = await materializePackage({ kind: "folder", path: pkgDir }, staging);
      expect(result.manifest.name).toBe("x");
      expect(result.builtFromSource).toBe(false);
      expect(existsSync(join(staging, "package.json"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/* ─────────────────────────── rescue mode ─────────────────────────── */

describe("rescue mode watchdog", () => {
  const PATCH = [
    "- id: ext-center",
    "  name: better-deepseek-harness",
    "- id: broken",
    "  name: broken-plugin",
    "- id: fine",
    "  name: fine-plugin",
    ""
  ].join("\n");

  function mountedOf(dir: string, options: { loaderEntries?: MockOptions["loaderEntries"]; config?: Record<string, unknown> } = {}) {
    const { ctx, disposers } = mockCtx({
      baseUrl: pathToFileURL(join(dir, "package.json")).href,
      loaderEntries: options.loaderEntries
    });
    apply(ctx, options.config ?? {});
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return {
      disposers,
      handler: register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>
    };
  }

  it("applies rescue (disables every third-party plugin) when the previous boot never settled", () => {
    __setRescueHostHooks({ pid: 9999 });
    const dir = rescueProfile({ patch: PATCH, state: crashedState() });
    try {
      const { disposers } = mountedOf(dir);
      try {
        const raw = rescuePatchOf(dir);
        expect(rowDisabled(raw, "broken")).toBe(true);
        expect(rowDisabled(raw, "fine")).toBe(true);
        expect(rowDisabled(raw, "ext-center")).toBe(false);
        const state = rescueStateOf(dir);
        expect(state.phase).toBe("applied");
        expect(state.failure.kind).toBe("crash");
        expect(state.plugins.map((plugin: { name: string }) => plugin.name).sort()).toEqual(["broken-plugin", "fine-plugin"]);
        expect(state.boot.pid).toBe(9999);
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null });
    }
  });

  it("leaves a healthy boot alone, records it, and settles after the window", async () => {
    __setRescueHostHooks({ pid: 9999 });
    const dir = rescueProfile({ patch: PATCH, state: healthyState() });
    vi.useFakeTimers();
    try {
      const { disposers } = mountedOf(dir, { config: { rescue: { enabled: true, settleMs: 3000 } } });
      try {
        expect(rescuePatchOf(dir).includes("disabled: true")).toBe(false);
        let state = rescueStateOf(dir);
        expect(state.boot.pid).toBe(9999);
        expect(state.boot.healthy).toBe(false);
        await vi.advanceTimersByTimeAsync(3000);
        state = rescueStateOf(dir);
        expect(state.boot.healthy).toBe(true);
        expect(state.phase).toBe("idle");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null });
    }
  });

  it("applies rescue when a third-party entry's fiber is already failed at apply time", () => {
    __setRescueHostHooks({ pid: 9999 });
    const dir = rescueProfile({ patch: PATCH, state: healthyState() });
    try {
      const { disposers } = mountedOf(dir, {
        loaderEntries: [
          { id: "broken", options: { name: "broken-plugin" }, fiber: { state: 3 } },
          { id: "fine", options: { name: "fine-plugin" }, fiber: { state: 2 } }
        ]
      });
      try {
        const state = rescueStateOf(dir);
        expect(state.phase).toBe("applied");
        expect(state.failure.kind).toBe("fiber-failed");
        expect(state.failure.message).toContain("broken-plugin");
        // rescue disables every third-party plugin by default — the failed
        // entry triggers it, the healthy one is caught by the sweep
        const raw = rescuePatchOf(dir);
        expect(rowDisabled(raw, "broken")).toBe(true);
        expect(rowDisabled(raw, "fine")).toBe(true);
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null });
    }
  });

  it("applies rescue on duplicate loader entry ids", () => {
    __setRescueHostHooks({ pid: 9999 });
    const dir = rescueProfile({
      patch: "- id: ext-center\n  name: better-deepseek-harness\n- id: dup\n  name: p1\n- id: dup\n  name: p2\n",
      state: healthyState()
    });
    try {
      const { disposers } = mountedOf(dir);
      try {
        const state = rescueStateOf(dir);
        expect(state.phase).toBe("applied");
        expect(state.failure.kind).toBe("duplicate-ids");
        expect(state.plugins.map((plugin: { name: string }) => plugin.name).sort()).toEqual(["p1", "p2"]);
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null });
    }
  });

  it("stays inert when rescue.enabled is false", () => {
    __setRescueHostHooks({ pid: 9999 });
    const dir = rescueProfile({ patch: PATCH, state: crashedState() });
    try {
      const { disposers } = mountedOf(dir, { config: { rescue: { enabled: false } } });
      try {
        expect(rescuePatchOf(dir).includes("disabled: true")).toBe(false);
        expect(rescueStateOf(dir).phase).toBe("idle");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null });
    }
  });

  it("records nothing when the profile has no patch layer (default fixtures stay inert)", () => {
    const { ctx } = mockCtx();
    expect(() => apply(ctx, {})).not.toThrow();
    // the default baseUrl points at lib/, which has no cordis.patch.yml —
    // the watchdog must skip it entirely
    expect(existsSync(join(process.cwd(), "lib", ".dsh-rescue.json"))).toBe(false);
  });
});

describe("rescue mode routes", () => {
  const PATCH = [
    "- id: ext-center",
    "  name: better-deepseek-harness",
    "- id: broken",
    "  name: broken-plugin",
    "- id: fine",
    "  name: fine-plugin",
    ""
  ].join("\n");

  async function mountedRescue(dir: string, options: { loaderEntries?: MockOptions["loaderEntries"] } = {}) {
    const { ctx, disposers } = mockCtx({
      baseUrl: pathToFileURL(join(dir, "package.json")).href,
      loaderEntries: options.loaderEntries
    });
    apply(ctx, { rescue: { enabled: true, settleMs: 3000 } });
    const register = ctx.webServer.register as ReturnType<typeof vi.fn>;
    return {
      disposers,
      handler: register.mock.calls[0][0].handler as (req: unknown, res: unknown) => Promise<void>
    };
  }

  it("serves an active status with the disabled plugin list", async () => {
    const dir = rescueProfile({
      patch: PATCH,
      state: JSON.stringify({
        version: 1,
        phase: "applied",
        failure: { kind: "crash", message: "previous boot did not complete" },
        plugins: [
          { name: "broken-plugin", kind: "patch", reason: { code: "load-failed", detail: "MODULE_NOT_FOUND" }, id: "broken", rowIds: ["broken"] },
          { name: "fine-plugin", kind: "patch", reason: { code: "crash" }, id: "fine", rowIds: ["fine"] }
        ],
        appliedAt: "2026-01-01T00:00:00.000Z",
        boot: { pid: 1, startedAt: 0, healthy: false, healthyAt: null }
      })
    });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        const res = fakeRes();
        await handler(fakeReq("GET", "/ext/api/rescue/status", "127.0.0.1"), res);
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(true);
        expect(body.value.active).toBe(true);
        expect(body.value.plugins.map((plugin: { name: string }) => plugin.name)).toEqual(["broken-plugin", "fine-plugin"]);
        expect(body.value.failure.message).toContain("did not complete");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports rescue-inactive when resolving without an applied rescue", async () => {
    const dir = rescueProfile({ patch: PATCH, state: healthyState() });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        const res = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/apply", { enable: ["broken-plugin"] }), res);
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("rescue-inactive");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies the selection, keeps the rest disabled, and reloads the page in desktop mode", async () => {
    __setRescueHostHooks({ pid: 9999, isDesktop: true });
    // a healthy previous boot: the watchdog stays hands-off, so the API
    // trigger is what applies rescue in this scenario
    const dir = rescueProfile({ patch: PATCH, state: healthyState() });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        // trigger rescue through the API, then resolve with one plugin selected
        const triggerRes = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/trigger", {}), triggerRes);
        const triggerBody = JSON.parse(triggerRes.end.mock.calls[0][0]);
        expect(triggerBody.ok).toBe(true);
        expect(triggerBody.value.applied).toBe(true);
        expect(triggerBody.value.active).toBe(true);

        const res = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/apply", { enable: ["fine-plugin"] }), res);
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(true);
        expect(body.value.reload).toBe("page");
        expect(body.value.restored).toEqual(["fine-plugin"]);

        const raw = rescuePatchOf(dir);
        expect(rowDisabled(raw, "fine")).toBe(false);
        expect(rowDisabled(raw, "broken")).toBe(true);
        expect(rowDisabled(raw, "ext-center")).toBe(false);
        expect(rescueStateOf(dir).phase).toBe("idle");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null, isDesktop: null });
    }
  });

  it("keeps everything disabled and skips the reload for an empty selection", async () => {
    __setRescueHostHooks({ pid: 9999, isDesktop: true });
    const dir = rescueProfile({ patch: PATCH, state: crashedState() });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/trigger", {}), fakeRes());
        const res = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/apply", { enable: [] }), res);
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(true);
        expect(body.value.reload).toBe("none");
        expect(body.value.restored).toEqual([]);
        const raw = rescuePatchOf(dir);
        expect(rowDisabled(raw, "broken")).toBe(true);
        expect(rowDisabled(raw, "fine")).toBe(true);
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null, isDesktop: null });
    }
  });

  it("schedules a host restart when resolving outside the desktop host", async () => {
    const scheduleRestart = vi.fn();
    __setRescueHostHooks({ pid: 9999, isDesktop: false, scheduleRestart });
    const dir = rescueProfile({ patch: PATCH, state: crashedState() });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/trigger", {}), fakeRes());
        const res = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/apply", { enable: ["fine-plugin"] }), res);
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(true);
        expect(body.value.reload).toBe("process");
        expect(scheduleRestart).toHaveBeenCalledTimes(1);
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null, isDesktop: null, scheduleRestart: null });
    }
  });

  it("rejects an over-long enable list", async () => {
    __setRescueHostHooks({ pid: 9999, isDesktop: true });
    const dir = rescueProfile({ patch: PATCH, state: crashedState() });
    try {
      const { handler, disposers } = await mountedRescue(dir);
      try {
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/trigger", {}), fakeRes());
        const res = fakeRes();
        await handler(fakeReqWithBody("POST", "/ext/api/rescue/apply", { enable: Array.from({ length: 300 }, (_, i) => "p" + i) }), res);
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("bad-request");
      } finally {
        disposeAll(disposers);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      __setRescueHostHooks({ pid: null, isDesktop: null });
    }
  });
});
