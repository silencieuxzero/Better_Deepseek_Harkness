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
  llm?: { stream: (options: unknown) => AsyncIterable<unknown> } | undefined;
  /** value returned for ctx.get("attachments") (defaults to undefined). */
  attachments?: { readImage: (ref: unknown, signal?: unknown) => Promise<{ ref: { mediaType: string }, data: Uint8Array }> } | undefined;
  /** when true, ctx.inject stores the callback instead of running it now. */
  deferInject?: boolean;
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
    update: vi.fn(async () => {}),
    mutate: vi.fn(async () => {}),
    writable: true
  };
  const skills = { registerProvider: vi.fn(() => () => {}) };
  const pendingInject: Array<(child: unknown) => void> = [];
  const ctx = {
    baseUrl: pathToFileURL(join(process.cwd(), "lib", "index.js")).href,
    get: vi.fn((name: string) => {
      if (name === "settings") return settings;
      if (name === "skills") return skills;
      if (name === "llm") return options.llm;
      if (name === "attachments") return options.attachments;
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
        stored: { vision: { enabled: true, provider: "custom", model: "custom-vlm", apiUrl: "http://vision.test/v1/chat/completions" } },
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
      const rewritten = calls[0] as unknown as {
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };
      expect(rewritten.messages[0].content.some((block) => block.type === "text" && block.text?.includes("一张自定义路由的图片"))).toBe(true);
      expect(next).not.toHaveBeenCalled();
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
});
