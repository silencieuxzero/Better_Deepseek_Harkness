import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Built-artifact smoke: `lib/` is committed so installs stay build-free, and
 * the JS half of it must stay byte-identical to `src/` (scripts/copy-js.mjs
 * copies it; tsc only compiles the TypeScript half). This spec guards that
 * contract and proves the shipped entry points load under plain Node ESM.
 */
const root = new URL("..", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

describe("built lib/ artifact", () => {
  it("keeps index.js and client.js byte-identical to src/", () => {
    expect(read("lib/index.js")).toBe(read("src/index.js"));
    expect(read("lib/client.js")).toBe(read("src/client.js"));
  });

  it("loads the host entry and runs apply() under Node ESM", async () => {
    const { NAME, SETTINGS_NS, apply, inject } = await import("../lib/index.js");
    const ctx = {
      baseUrl: new URL("file:///" + process.cwd().replace(/\\/g, "/") + "/lib/index.js").href,
      get: () => undefined,
      effect: (fn: () => unknown) => {
        const dispose = fn();
        if (typeof dispose === "function") dispose();
        return dispose;
      },
      on: () => () => {},
      logger: {},
      tools: {},
      webServer: { register: () => {} }
    };
    expect(() => apply(ctx, {})).not.toThrow();
    expect(NAME).toBe("better-deepseek-harness");
    expect(SETTINGS_NS).toBe("ext-center");
    expect(inject).toEqual(["webServer", "tools"]);
  });

  it("loads the compiled tool-args.js", async () => {
    const { tryParseJsonObject, repairToolArguments } = await import("../lib/tool-args.js");
    expect(tryParseJsonObject('{"a": 1')).toEqual({ a: 1 });
    const repaired = repairToolArguments(
      { properties: { description: {} } },
      { a: 1 },
      { enabled: true, descriptionFill: "Execute tool" }
    );
    expect(repaired.changed).toBe(true);
    expect(repaired.arguments).toEqual({ a: 1, description: "Execute tool" });
  });

  it("loads the compiled tavily.js", async () => {
    const { TAVILY_DEFAULTS, validateTavilyApiKey, resolveTavilySettings } = await import("../lib/tavily.js");
    expect(TAVILY_DEFAULTS.maxResults).toBe(5);
    expect(validateTavilyApiKey("tvly-" + "a".repeat(32))).toBeNull();
    expect(resolveTavilySettings({ maxResults: 3 }).maxResults).toBe(3);
  });

  it("loads the compiled terminal-buffer.js", async () => {
    const { createTerminalBuffer, appendTerminalBuffer, terminalBufferSlice } = await import("../lib/terminal-buffer.js");
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "abcdefghij", 8);
    expect(terminalBufferSlice(state, 0)).toEqual({ text: "cdefghij", cursor: 10 });
  });
});
