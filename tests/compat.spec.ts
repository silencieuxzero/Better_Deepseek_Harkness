import { describe, it, expect } from "vitest";
import {
  DSH_WEB_UI_FAMILY,
  compatEntryActive,
  detectDshWebUi,
  dshWebUiSuppression,
  emptyDshWebUiPresence,
  type CompatEntryView,
} from "../src/compat.js";

/** One host-shaped loader view: entry id + package name + fiber state. */
function view(id: string, name: string, fiberState?: number, disabled?: boolean): CompatEntryView {
  return { id, name, fiberState, disabled };
}

const AIONUI = view("ui-dsh-aionui-panel", "@linxin666/dsh-client-ui-aionui-panel", 2);
const GIT_GRAPH = view("ui-git-graph", "@linxin666/dsh-client-ui-git-graph", 2);
const SSH = view("ssh", "@linxin666/dsh-ssh", 2);
const DESCRIBE_IMAGE = view("describe-image", "@linxin666/dsh-tool-describe-image", 2);

describe("compatEntryActive", () => {
  it("counts an ACTIVE non-disabled fiber", () => {
    expect(compatEntryActive(view("x", "y", 2))).toBe(true);
  });

  it("rejects pending, loading, failed and absent fibers", () => {
    expect(compatEntryActive(view("x", "y", 0))).toBe(false);
    expect(compatEntryActive(view("x", "y", 1))).toBe(false);
    expect(compatEntryActive(view("x", "y", 3))).toBe(false);
    expect(compatEntryActive(view("x", "y", 4))).toBe(false);
    expect(compatEntryActive(view("x", "y"))).toBe(false);
  });

  it("rejects disabled entries even when the fiber reports ACTIVE", () => {
    expect(compatEntryActive(view("x", "y", 2, true))).toBe(false);
  });
});

describe("detectDshWebUi", () => {
  it("detects every family member by its loader entry id", () => {
    const presence = detectDshWebUi([view("ui-dsh-aionui-panel", "", 2)]);
    expect(presence.aionuiPanel).toBe(true);
    expect(presence.gitGraph).toBe(false);
    expect(presence.ssh).toBe(false);
    expect(presence.describeImage).toBe(false);
  });

  it("detects every family member by its npm package name", () => {
    expect(detectDshWebUi([view("", "@linxin666/dsh-client-ui-git-graph", 2)]).gitGraph).toBe(true);
    expect(detectDshWebUi([view("", "@linxin666/dsh-ssh", 2)]).ssh).toBe(true);
    expect(detectDshWebUi([view("", "@linxin666/dsh-tool-describe-image", 2)]).describeImage).toBe(true);
  });

  it("ignores entries that are not ACTIVE (pending or failed)", () => {
    expect(detectDshWebUi([view("ssh", "@linxin666/dsh-ssh", 0)]).ssh).toBe(false);
    expect(detectDshWebUi([view("ssh", "@linxin666/dsh-ssh", 3)]).ssh).toBe(false);
    expect(detectDshWebUi([view("ssh", "@linxin666/dsh-ssh", 2, true)]).ssh).toBe(false);
  });

  it("ignores unknown third-party and harness entries", () => {
    const presence = detectDshWebUi([
      view("ext-center", "better-deepseek-harness", 2),
      view("some-other-plugin", "some-other-plugin", 2),
      view("ui-web-ui-compat", "@linxin666/dsh-web-ui-all", 2),
    ]);
    expect(presence).toEqual(emptyDshWebUiPresence());
  });

  it("detects several family members at once", () => {
    const presence = detectDshWebUi([AIONUI, SSH, DESCRIBE_IMAGE]);
    expect(presence.aionuiPanel).toBe(true);
    expect(presence.gitGraph).toBe(false);
    expect(presence.ssh).toBe(true);
    expect(presence.describeImage).toBe(true);
  });

  it("survives an empty view set", () => {
    expect(detectDshWebUi([])).toEqual(emptyDshWebUiPresence());
  });
});

describe("dshWebUiSuppression", () => {
  it("suppresses nothing when the family is absent", () => {
    expect(dshWebUiSuppression(emptyDshWebUiPresence())).toEqual({
      tree: false,
      git: false,
      terminal: false,
      vision: false,
    });
  });

  it("lets aionui-panel own the file tree and the git surface", () => {
    const suppression = dshWebUiSuppression({ ...emptyDshWebUiPresence(), aionuiPanel: true });
    expect(suppression.tree).toBe(true);
    expect(suppression.git).toBe(true);
    expect(suppression.terminal).toBe(false);
    expect(suppression.vision).toBe(false);
  });

  it("lets git-graph own the git surface", () => {
    const suppression = dshWebUiSuppression({ ...emptyDshWebUiPresence(), gitGraph: true });
    expect(suppression.tree).toBe(false);
    expect(suppression.git).toBe(true);
    expect(suppression.terminal).toBe(false);
    expect(suppression.vision).toBe(false);
  });

  it("lets dsh-ssh own the terminal surface", () => {
    const suppression = dshWebUiSuppression({ ...emptyDshWebUiPresence(), ssh: true });
    expect(suppression.terminal).toBe(true);
    expect(suppression.tree).toBe(false);
    expect(suppression.git).toBe(false);
    expect(suppression.vision).toBe(false);
  });

  it("lets describe-image own image understanding", () => {
    const suppression = dshWebUiSuppression({ ...emptyDshWebUiPresence(), describeImage: true });
    expect(suppression.vision).toBe(true);
    expect(suppression.tree).toBe(false);
    expect(suppression.git).toBe(false);
    expect(suppression.terminal).toBe(false);
  });

  it("maps a full family presence to full suppression", () => {
    const suppression = dshWebUiSuppression({
      aionuiPanel: true,
      gitGraph: true,
      ssh: true,
      describeImage: true,
    });
    expect(suppression).toEqual({ tree: true, git: true, terminal: true, vision: true });
  });

  it("detect + suppress round-trips through a realistic loader tree", () => {
    const entries = [
      view("ext-center", "better-deepseek-harness", 2),
      view("ui-dsh-aionui-panel", "@linxin666/dsh-client-ui-aionui-panel", 2),
      view("ui-git-graph", "@linxin666/dsh-client-ui-git-graph", 1), // still loading — does not suppress yet
      view("pet", "@linxin666/dsh-pet", 2), // family member without a conflicting surface
      view("ssh", "@linxin666/dsh-ssh", 3), // failed — our terminal stays
    ];
    const suppression = dshWebUiSuppression(detectDshWebUi(entries));
    expect(suppression).toEqual({ tree: true, git: true, terminal: false, vision: false });
  });

  it("declares the family registry exactly once per member", () => {
    const keys = DSH_WEB_UI_FAMILY.map((member) => member.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
