import { describe, it, expect } from "vitest";
import {
  NOTIFY_AUMID,
  NOTIFY_BODY_CAP,
  NOTIFY_DEFAULTS,
  NOTIFY_ERROR_CAP,
  buildDoneBody,
  buildQuestionBody,
  buildToastScript,
  capText,
  createFlowTracker,
  escapePowerShellSingleQuoted,
  formatDuration,
  notifyTitleFor,
  platformIsWindows,
  resolveNotifySettings
} from "../src/notify.js";

describe("resolveNotifySettings", () => {
  it("returns the documented defaults for an empty section", () => {
    expect(resolveNotifySettings(undefined)).toEqual(NOTIFY_DEFAULTS);
  });

  it("merges stored values over the defaults", () => {
    const settings = resolveNotifySettings({ enabled: false, onQuestion: false, onDone: false });
    expect(settings).toEqual({ enabled: false, onQuestion: false, onDone: false });
  });

  it("degrades invalid stored values without throwing (fail-closed on non-booleans)", () => {
    const settings = resolveNotifySettings({ enabled: "yes", onQuestion: 1, onDone: null });
    expect(settings).toEqual({ enabled: false, onQuestion: false, onDone: false });
  });
});

describe("platformIsWindows", () => {
  it("accepts only win32", () => {
    expect(platformIsWindows("win32")).toBe(true);
    expect(platformIsWindows("linux")).toBe(false);
    expect(platformIsWindows("darwin")).toBe(false);
  });
});

describe("capText", () => {
  it("keeps short text and collapses newlines", () => {
    expect(capText("hello", 100)).toBe("hello");
    expect(capText("a\r\nb", 100)).toBe("a b");
  });

  it("truncates with a single ellipsis at the cap", () => {
    const capped = capText("x".repeat(300), 10);
    expect(capped).toHaveLength(10);
    expect(capped.endsWith("…")).toBe(true);
  });
});

describe("escapePowerShellSingleQuoted", () => {
  it("doubles every quote", () => {
    expect(escapePowerShellSingleQuoted("it's")).toBe("it''s");
    expect(escapePowerShellSingleQuoted("no quotes")).toBe("no quotes");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatDuration(0)).toBe("0 秒");
    expect(formatDuration(32000)).toBe("32 秒");
    expect(formatDuration(252000)).toBe("4 分 12 秒");
    expect(formatDuration(120000)).toBe("2 分");
    expect(formatDuration(3600000)).toBe("1 小时");
    expect(formatDuration(5400000)).toBe("1 小时 30 分");
  });
});

describe("notifyTitleFor", () => {
  it("uses the question and done titles", () => {
    expect(notifyTitleFor("question")).toContain("需要你的输入");
    expect(notifyTitleFor("done")).toContain("流程结束");
  });
});

describe("buildQuestionBody", () => {
  it("joins question texts with a fallback to headers", () => {
    expect(buildQuestionBody([
      { question: "继续吗？", header: "确认" },
      { header: "第二个问题" }
    ])).toBe("继续吗？ / 第二个问题");
  });

  it("collapses to a fixed notice when nothing usable is given", () => {
    expect(buildQuestionBody(undefined)).toBe("请在对话界面查看问题");
    expect(buildQuestionBody([{ id: "x" }])).toBe("请在对话界面查看问题");
  });

  it("caps the summary", () => {
    const body = buildQuestionBody([{ question: "q".repeat(500) }]);
    expect(body).toHaveLength(NOTIFY_BODY_CAP);
  });
});

describe("buildDoneBody", () => {
  it("reports completion with the duration", () => {
    expect(buildDoneBody({ failed: false, durationMs: 32000 })).toBe("已完成（耗时 32 秒）");
  });

  it("reports failures with a capped error summary", () => {
    const body = buildDoneBody({ failed: true, error: "e".repeat(500), durationMs: 1000 });
    expect(body.startsWith("出错：")).toBe(true);
    expect(body.length).toBeLessThanOrEqual(NOTIFY_BODY_CAP);
    const error = body.slice("出错：".length, "出错：".length + NOTIFY_ERROR_CAP);
    expect(error).toBe("e".repeat(NOTIFY_ERROR_CAP - 1) + "…");
    expect(body).toContain("（耗时 1 秒）");
  });

  it("omits the duration when unknown", () => {
    expect(buildDoneBody({ failed: false })).toBe("已完成");
  });
});

describe("buildToastScript", () => {
  it("embeds title and body as single-quoted PowerShell literals", () => {
    const script = buildToastScript("标题", "正文 it's fine");
    expect(script).toContain("CreateTextNode('标题')");
    expect(script).toContain("CreateTextNode('正文 it''s fine')");
  });

  it("registers the notifier AUMID idempotently through a Start Menu shortcut", () => {
    const script = buildToastScript("t", "b");
    expect(script).toContain(`$Aumid = '${NOTIFY_AUMID}'`);
    expect(script).toContain("Start Menu\\Programs\\DeepSeek Harness Notifier.lnk");
    expect(script).toContain("if (-not (Test-Path $ShortcutPath))");
    expect(script).toContain("ShortcutRegistrar");
    expect(script).toContain("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
  });

  it("shows the toast through the registered AUMID notifier", () => {
    const script = buildToastScript("t", "b");
    expect(script).toContain("ToastText02");
    expect(script).toContain("CreateToastNotifier($Aumid).Show($toast)");
    expect(script).toContain("$ErrorActionPreference = 'Stop'");
  });

  it("never contains a raw quote that could break the literal embedding", () => {
    const script = buildToastScript("a'b", "c'd");
    const titleLine = script.split("\n").find((line) => line.includes("CreateTextNode('a''b')"));
    expect(titleLine).toBeTruthy();
    expect(titleLine).not.toContain("'a'b'");
  });
});

describe("createFlowTracker", () => {
  it("reports one end per running → idle transition", () => {
    const tracker = createFlowTracker();
    expect(tracker.onStatus("a1", "running", 1000)).toBeNull();
    const ended = tracker.onStatus("a1", "idle", 5000);
    expect(ended).toEqual({ kind: "ended", record: { startedAt: 1000, failed: null } });
    expect(tracker.onStatus("a1", "idle", 6000)).toBeNull();
  });

  it("ignores idle without a tracked start", () => {
    const tracker = createFlowTracker();
    expect(tracker.onStatus("a1", "idle", 1000)).toBeNull();
  });

  it("keeps the original start on repeated running events", () => {
    const tracker = createFlowTracker();
    tracker.onStatus("a1", "running", 1000);
    tracker.onStatus("a1", "running", 2000);
    const ended = tracker.onStatus("a1", "idle", 3000);
    expect(ended?.record.startedAt).toBe(1000);
  });

  it("records observed errors into the run", () => {
    const tracker = createFlowTracker();
    tracker.onStatus("a1", "running", 1000);
    tracker.onError("a1", "boom");
    const ended = tracker.onStatus("a1", "idle", 2000);
    expect(ended?.record.failed).toBe("boom");
  });

  it("caps recorded errors and ignores errors for untracked agents", () => {
    const tracker = createFlowTracker();
    tracker.onError("nobody", "nope");
    tracker.onStatus("a1", "running", 0);
    tracker.onError("a1", "x".repeat(500));
    const ended = tracker.onStatus("a1", "idle", 1);
    expect(ended?.record.failed).toHaveLength(NOTIFY_ERROR_CAP);
  });
});
