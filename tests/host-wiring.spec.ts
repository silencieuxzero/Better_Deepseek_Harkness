import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { apply, inject, NAME, SETTINGS_NS } from "../src/index.js";

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
  /** when true, ctx.inject stores the callback instead of running it now. */
  deferInject?: boolean;
  /** when true, ctx.get("settings") throws like a missing cordis service. */
  noSettings?: boolean;
  /** when true, ctx.get("skills") throws like a missing cordis service. */
  noSkills?: boolean;
}

function mockCtx(options: MockOptions = {}) {
  const disposers: Array<() => void> = [];
  const registrations: {
    routes: Array<{ path: string; handler: (req: unknown, res: unknown) => Promise<void> }>;
    events: string[];
  } = { routes: [], events: [] };
  const settings = {
    register: vi.fn(() => () => {}),
    get: vi.fn(() => options.stored ?? {}),
    update: vi.fn(async (_ns: string, _patch: Record<string, unknown>) => {}),
    mutate: vi.fn(async (_ns: string, _ops: Array<Record<string, unknown>>) => {}),
    writable: true
  };
  const skills = { registerProvider: vi.fn(() => () => {}) };
  const pendingInject: Array<(child: unknown) => void> = [];
  const ctx = {
    baseUrl: pathToFileURL(join(process.cwd(), "lib", "index.js")).href,
    get: vi.fn((name: string) => {
      // cordis throws when the requested service is not mounted; the plugin
      // must treat every optional service lookup as best-effort.
      if (name === "settings" && options.noSettings) throw new Error("service settings is not mounted");
      if (name === "skills" && options.noSkills) throw new Error("service skills is not mounted");
      if (name === "settings") return settings;
      if (name === "skills") return skills;
      if (name === "llm") return options.llm;
      if (name === "attachments") return options.attachments;
      if (name === "workspaceRegistry") return options.workspaceRegistry;
      if (name === "sessionPersistence") return options.sessionPersistence;
      if (name === "sessions") return options.sessions;
      return undefined;
    }),
    inject: vi.fn((names: string[], callback: (child: unknown) => void) => {
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
    tools: { get: vi.fn(() => undefined) },
    webServer: {
      register: vi.fn((entry: { path: string; handler: (req: unknown, res: unknown) => Promise<void> }) => {
        registrations.routes.push(entry);
        return () => {};
      })
    }
  };
  return { ctx, settings, skills, disposers, registrations, pendingInject };
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
    expect(inject).toEqual(["webServer", "tools"]);
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
    expect(pendingInject).toHaveLength(1);
    // the settings service comes up later; the deferred fiber then registers
    const child = { settings: { register: vi.fn(() => () => {}) }, logger: ctx.logger };
    pendingInject[0](child);
    expect(child.settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
  });

  it("registers the settings namespace when settings is available at apply time", () => {
    const { ctx, settings } = mockCtx();
    apply(ctx, {});
    expect(settings.register).toHaveBeenCalledWith(SETTINGS_NS, expect.anything(), expect.anything());
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
            apiKey: "sk-test-123"
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
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
      expect(init.headers.authorization).toBe("Bearer sk-test-123");
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
