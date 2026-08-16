import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

/**
 * The git discard endpoint distinguishes the staged row from the unstaged
 * row. A `MM` porcelain record appears in both groups client-side, but only
 * the staged-row discard may reset the index; the unstaged-row discard must
 * preserve the staged version. These specs mock child_process.spawn and
 * assert the exact git commands each row produces.
 */

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({
  spawn: spawnMock,
  spawnSync: vi.fn()
}));

import { apply } from "../src/index.js";

/** A minimal child_process spawn double that reports success with stdout. */
function fakeGitChild(stdout: string) {
  const on = vi.fn((event: string, callback: (value?: unknown) => void) => {
    if (event === "close") setImmediate(() => callback(0));
    return on;
  });
  const stdoutStream = { on: vi.fn((_event: string, callback: (chunk: Buffer) => void) => {
    setImmediate(() => callback(Buffer.from(stdout)));
  }) };
  const stderrStream = { on: vi.fn(() => {}) };
  return { stdout: stdoutStream, stderr: stderrStream, on, kill: vi.fn() };
}

const STATUS_MM = [
  "# branch.oid 1111111111111111111111111111111111111111",
  "# branch.head main",
  "1 MM N... 100644 100644 100644 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 f.txt",
  ""
].join("\n");

/** Mount the /ext/api git routes in a temp profile whose workspace is `repo`. */
async function mountedGitHandler(repo: string) {
  const registrations: Array<{ path: string; handler: (req: unknown, res: unknown) => Promise<void> }> = [];
  const webServer = {
    register: vi.fn((entry: { path: string; handler: (req: unknown, res: unknown) => Promise<void> }) => {
      registrations.push(entry);
      return () => {};
    })
  };
  const workspaceRegistry = {
    archivedSessionIds: [],
    list: vi.fn(() => [{ path: repo, sessionIds: ["s1"] }])
  };
  const ctx = {
    baseUrl: pathToFileURL(join(repo, "package.json")).href,
    get: vi.fn((name: string) => {
      if (name === "loader") return { entries: () => [] };
      if (name === "webServer") return webServer;
      if (name === "workspaceRegistry") return workspaceRegistry;
      if (name === "settings") return { get: () => ({}), register: vi.fn(() => ({ watch: vi.fn(() => () => {}) })), writable: true };
      if (name === "skills") return { registerProvider: vi.fn(() => () => {}) };
      if (name === "tools") return { get: vi.fn(() => undefined), register: vi.fn(() => () => {}) };
      return undefined;
    }),
    inject: vi.fn(() => () => {}),
    effect: vi.fn((fn: () => unknown) => (typeof fn === "function" ? fn() : undefined)),
    on: vi.fn(() => () => {}),
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    tools: { get: vi.fn(() => undefined), register: vi.fn(() => () => {}) }
  };
  apply(ctx, {});
  expect(registrations[0]?.path).toBe("/ext/api");
  return { handler: registrations[0].handler, spawnMock };
}

function fakeReqWithBody(url: string, payload: Record<string, unknown>) {
  const req = {
    method: "POST",
    url,
    socket: { remoteAddress: "127.0.0.1" },
    on: vi.fn((event: string, cb: (value?: Buffer) => void) => {
      if (event === "data") cb(Buffer.from(JSON.stringify(payload)));
      if (event === "end") cb();
    })
  };
  return req;
}

beforeEach(() => {
  spawnMock.mockReset();
});

describe("git discard wiring", () => {
  it("resets index and worktree for a staged-row discard", async () => {
    const repo = mkdtempSync(join(tmpdir(), "dsh-git-"));
    try {
      mkdirSync(join(repo, ".git"));
      writeFileSync(join(repo, "f.txt"), "staged\n");
      spawnMock.mockReturnValue(fakeGitChild(STATUS_MM));
      const { handler } = await mountedGitHandler(repo);
      const res = { writeHead: vi.fn(), end: vi.fn() };
      await handler(fakeReqWithBody("/ext/api/git/discard", { sessionId: "s1", paths: ["f.txt"], staged: true }), res);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
      const gitCalls = spawnMock.mock.calls.map((call) => call[1] as string[]);
      expect(gitCalls).toContainEqual(expect.arrayContaining(["restore", "--staged", "--worktree", "--", "f.txt"]));
      expect(gitCalls.some((args) => args.includes("checkout") && args.includes("--"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("restores only the worktree for an unstaged-row discard", async () => {
    const repo = mkdtempSync(join(tmpdir(), "dsh-git-"));
    try {
      mkdirSync(join(repo, ".git"));
      writeFileSync(join(repo, "f.txt"), "staged\n");
      spawnMock.mockReturnValue(fakeGitChild(STATUS_MM));
      const { handler } = await mountedGitHandler(repo);
      const res = { writeHead: vi.fn(), end: vi.fn() };
      await handler(fakeReqWithBody("/ext/api/git/discard", { sessionId: "s1", paths: ["f.txt"], staged: false }), res);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
      const gitCalls = spawnMock.mock.calls.map((call) => call[1] as string[]);
      expect(gitCalls).toContainEqual(expect.arrayContaining(["checkout", "--", "f.txt"]));
      expect(gitCalls.some((args) => args.includes("restore"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
