import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DSH_WEB_UI_FAMILY } from "../src/compat.js";

/**
 * The browser half cannot import `src/compat.ts` (the client bundle is a
 * standalone `__ModuleLoader__` factory), so `src/client.js` carries an
 * inline copy of the family registry. This spec guards that the inline copy
 * does not drift from the TypeScript source of truth.
 */
const client = readFileSync(new URL("../src/client.js", import.meta.url), "utf8");

describe("client.js dsh-web-ui compat table", () => {
  it("inlines every family package name", () => {
    for (const member of DSH_WEB_UI_FAMILY) {
      for (const name of member.names) {
        expect(client, `client.js must know ${name}`).toContain(name);
      }
    }
  });

  it("inlines every family loader entry id", () => {
    for (const member of DSH_WEB_UI_FAMILY) {
      for (const id of member.ids) {
        expect(client, `client.js must know the ${id} entry id`).toContain(id);
      }
    }
  });

  it("inlines the suppression mapping keys", () => {
    for (const key of ["aionuiPanel", "gitGraph", "ssh", "describeImage", "tree", "git", "terminal", "vision"]) {
      expect(client, `client.js must know the ${key} surface key`).toContain(key);
    }
  });

  it("bounds API requests with a client-side timeout", () => {
    expect(client).toContain("createRequestSignal");
    expect(client).toContain("API_DEFAULT_TIMEOUT_MS");
    expect(client).toContain("API_INSTALL_TIMEOUT_MS");
    expect(client).toContain("request timed out");
  });

  it("keeps re-checking the loader until late family bundles settle", () => {
    expect(client).toContain("watcherTimer");
    expect(client).toContain("syncSurfaces");
    expect(client).toContain("disposeSurface");
  });
});
