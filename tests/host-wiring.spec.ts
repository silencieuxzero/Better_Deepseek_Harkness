import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { apply, inject, NAME, SETTINGS_NS } from "../src/index.js";

/**
 * A minimal cordis ctx double for apply(). `baseUrl` must be a real file URL
 * because resolveLayout() derives the profile directory from it; nothing is
 * written during apply(), so pointing it at lib/index.js is safe.
 */
function mockCtx() {
  const disposers: Array<() => void> = [];
  const registrations: {
    routes: Array<{ path: string; handler: (req: unknown, res: unknown) => Promise<void> }>;
    events: string[];
  } = { routes: [], events: [] };
  const settings = { register: vi.fn(() => () => {}) };
  const skills = { registerProvider: vi.fn(() => () => {}) };
  const ctx = {
    baseUrl: pathToFileURL(join(process.cwd(), "lib", "index.js")).href,
    get: vi.fn((name: string) => (name === "settings" ? settings : name === "skills" ? skills : undefined)),
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
  return { ctx, settings, skills, disposers, registrations };
}

function fakeRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function fakeReq(method: string, url: string, remoteAddress: string) {
  return { method, url, socket: { remoteAddress } };
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

  it("fails loud on an invalid config block", () => {
    const { ctx } = mockCtx();
    expect(() => apply(ctx, { tree: { maxEntries: 0 } })).toThrow(/invalid config/);
    expect(() => apply(ctx, { terminal: { maxSessions: 99 } })).toThrow(/invalid config/);
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
});
