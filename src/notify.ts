/**
 * Windows notifications — pure logic (settings, message formatting, toast
 * script building, agent-flow tracking). No I/O: the host half wires this
 * module to the PowerShell/Electron notifier and the harness event
 * listeners; the tests cover behavior here.
 * @module better-deepseek-harness/notify
 */

export interface NotifySettings {
  /** Master switch: false disables every Windows notification. */
  enabled: boolean;
  /** Notify when the model asks the user a question (ask_user_question). */
  onQuestion: boolean;
  /** Notify when an agent flow ends (completed or failed). */
  onDone: boolean;
}

/** The settings a fresh deployment starts from; every field owns its default. */
export const NOTIFY_DEFAULTS: Readonly<NotifySettings> = Object.freeze({
  enabled: true,
  onQuestion: true,
  onDone: true
});

/** Toast title cap (chars) — fixed, toast UIs truncate long titles. */
export const NOTIFY_TITLE_CAP = 64;
/** Toast body cap (chars) — fixed, keeps one toast compact. */
export const NOTIFY_BODY_CAP = 240;
/** Cap on the error summary embedded in a done notification. */
export const NOTIFY_ERROR_CAP = 160;
/** PowerShell spawn timeout (ms) — a hung notifier must never linger. */
export const NOTIFY_SPAWN_TIMEOUT_MS = 15000;
/**
 * The notifier's AppUserModelID. Unpackaged apps can only display toasts when
 * this AUMID is registered through a Start Menu shortcut carrying the
 * AppUserModelID property — the script registers it once (idempotent) before
 * the first toast.
 */
export const NOTIFY_AUMID = "DeepSeekHarness.Notifier";
/** The Start Menu shortcut path anchoring the AUMID registration. */
export const NOTIFY_SHORTCUT_NAME = "DeepSeek Harness Notifier.lnk";

/**
 * The one-time AUMID registration preamble: creates the Start Menu shortcut
 * (WScript.Shell) and stamps the AppUserModelID property on it through
 * IPropertyStore (P/Invoke). Registration is idempotent (guarded by
 * Test-Path) and failure is non-fatal — the toast is still attempted.
 */
const REGISTRATION_PREAMBLE = [
  "$ErrorActionPreference = 'Stop'",
  `$Aumid = '${NOTIFY_AUMID}'`,
  "$ShortcutPath = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\" + NOTIFY_SHORTCUT_NAME + "'",
  "if (-not (Test-Path $ShortcutPath)) {",
  "  $WsShell = New-Object -ComObject WScript.Shell",
  "  $Shortcut = $WsShell.CreateShortcut($ShortcutPath)",
  "  $Shortcut.TargetPath = \"$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\"",
  "  $Shortcut.Save()",
  "  try {",
  "    Add-Type -TypeDefinition @'",
  "using System;",
  "using System.Runtime.InteropServices;",
  "public static class ShortcutRegistrar {",
  "    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]",
  "    public struct PROPERTYKEY { public Guid fmtid; public uint pid; }",
  "    [StructLayout(LayoutKind.Sequential)]",
  "    public struct PROPVARIANT { public ushort vt; public ushort wReserved1; public ushort wReserved2; public ushort wReserved3; public IntPtr p; }",
  "    [DllImport(\"shell32.dll\", SetLastError = true)]",
  "    private static extern int SHGetPropertyStoreFromParsingName([MarshalAs(UnmanagedType.LPWStr)] string pszPath, IntPtr pbc, uint flags, ref Guid riid, out IntPtr ppv);",
  "    [ComImport, Guid(\"886d8eeb-8cf2-4446-8d02-cdba1dbdcf99\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "    private interface IPropertyStore {",
  "        int GetCount(out uint cProps);",
  "        int GetAt(uint iProp, out PROPERTYKEY pkey);",
  "        int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);",
  "        int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);",
  "        int Commit();",
  "    }",
  "    private static readonly Guid FMTID_AppUserModelId = new Guid(\"9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3\");",
  "    private static readonly Guid IID_IPropertyStore = new Guid(\"886d8eeb-8cf2-4446-8d02-cdba1dbdcf99\");",
  "    public static void Register(string shortcutPath, string appId) {",
  "        IntPtr storePtr;",
  "        int hr = SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, 0, ref IID_IPropertyStore, out storePtr);",
  "        if (hr != 0) throw new System.ComponentModel.Win32Exception(hr);",
  "        IPropertyStore store = (IPropertyStore)Marshal.GetObjectForIUnknown(storePtr);",
  "        try {",
  "            PROPERTYKEY key = new PROPERTYKEY();",
  "            key.fmtid = FMTID_AppUserModelId;",
  "            key.pid = 5;",
  "            PROPVARIANT value = new PROPVARIANT();",
  "            value.vt = 31;",
  "            value.p = Marshal.StringToCoTaskMemUni(appId);",
  "            try {",
  "                hr = store.SetValue(ref key, ref value);",
  "                if (hr != 0) throw new System.ComponentModel.Win32Exception(hr);",
  "                hr = store.Commit();",
  "                if (hr != 0) throw new System.ComponentModel.Win32Exception(hr);",
  "            } finally {",
  "                Marshal.FreeCoTaskMem(value.p);",
  "            }",
  "        } finally {",
  "            Marshal.Release(storePtr);",
  "        }",
  "    }",
  "}",
  "'@",
  "    [ShortcutRegistrar]::Register($ShortcutPath, $Aumid)",
  "  } catch {",
  "    # registration failure is non-fatal: the toast is still attempted",
  "  }",
  "}"
].join("\n");

/**
 * Build the complete Windows PowerShell toast script. The idempotent AUMID
 * registration preamble runs first (one-time cost), then a WinRT
 * `ToastText02` toast is shown through `CreateToastNotifier($Aumid)`. Title
 * and body are embedded as single-quoted literals (quotes doubled) and
 * appended through `CreateTextNode`, so no XML escaping is needed and the
 * script is safe to ship through `-EncodedCommand` (UTF-16LE base64).
 *
 * @param title - the toast title (capped by the caller).
 * @param body - the toast body (capped by the caller).
 * @returns the PowerShell script.
 */
export function buildToastScript(title: string, body: string): string {
  const literal = (text: string) => `'${escapePowerShellSingleQuoted(text)}'`;
  return [
    REGISTRATION_PREAMBLE,
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
    "$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    "$texts = $template.GetElementsByTagName('text')",
    `$null = $texts.Item(0).AppendChild($template.CreateTextNode(${literal(title)}))`,
    `$null = $texts.Item(1).AppendChild($template.CreateTextNode(${literal(body)}))`,
    "$toast = [Windows.UI.Notifications.ToastNotification]::new($template)",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($Aumid).Show($toast)"
  ].join("\n");
}

/**
 * Resolve the stored `notify` settings section with explicit defaults. Invalid
 * stored values fall back to defaults instead of throwing — the settings
 * schema already rejects bad writes, so this only guards hand-edited files.
 *
 * @param value - the raw `notify` section (any JSON value).
 * @returns the fully-defaulted settings.
 */
export function resolveNotifySettings(value: unknown): NotifySettings {
  const stored = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    enabled: stored.enabled === void 0 ? NOTIFY_DEFAULTS.enabled : stored.enabled === true,
    onQuestion: stored.onQuestion === void 0 ? NOTIFY_DEFAULTS.onQuestion : stored.onQuestion === true,
    onDone: stored.onDone === void 0 ? NOTIFY_DEFAULTS.onDone : stored.onDone === true
  };
}

/** Whether the host platform can show Windows toasts. */
export function platformIsWindows(platform: string): boolean {
  return platform === "win32";
}

/**
 * Cap a text to `cap` chars, appending a single ellipsis when truncated.
 * Newlines are collapsed to spaces so toast text stays one compact block.
 *
 * @param text - the raw text.
 * @param cap - the char ceiling.
 * @returns the capped text.
 */
export function capText(text: string, cap: number): string {
  const flat = text.replace(/[\r\n]+/g, " ").trim();
  if (flat.length <= cap) return flat;
  return flat.slice(0, cap - 1) + "…";
}

/**
 * Escape a string for embedding inside a PowerShell single-quoted literal
 * (the only escape in that context is doubling the quote).
 *
 * @param text - the raw text.
 * @returns the literal-safe text.
 */
export function escapePowerShellSingleQuoted(text: string): string {
  return text.replace(/'/g, "''");
}

/** Human-readable duration ("32 秒", "4 分 12 秒"). */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds === 0 ? `${minutes} 分` : `${minutes} 分 ${seconds} 秒`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours} 小时` : `${hours} 小时 ${restMinutes} 分`;
}

export type NotifyKind = "question" | "done";

/** Toast title for a question notification. */
export function notifyTitleFor(kind: NotifyKind): string {
  return kind === "question" ? "DeepSeek Harness 需要你的输入" : "DeepSeek Harness 流程结束";
}

/**
 * Build the question-notification body: the first question's text (header
 * fallback), joined when the tool asks several at once.
 *
 * @param questions - the raw `questions` argument of ask_user_question.
 * @param cap - body cap in chars.
 * @returns the summary body.
 */
export function buildQuestionBody(questions: unknown, cap: number = NOTIFY_BODY_CAP): string {
  const items = Array.isArray(questions) ? questions : [];
  const parts: string[] = [];
  for (const entry of items) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const question = typeof row.question === "string" && row.question.trim() !== "" ? row.question.trim() : "";
    const header = typeof row.header === "string" && row.header.trim() !== "" ? row.header.trim() : "";
    const part = question !== "" ? question : header;
    if (part !== "") parts.push(part);
  }
  if (parts.length === 0) return "请在对话界面查看问题";
  return capText(parts.join(" / "), cap);
}

export interface DoneOutcome {
  /** Whether the flow errored (agent/error was observed during the run). */
  failed: boolean;
  /** Capped error summary (when failed). */
  error?: string;
  /** Run duration in ms, when the start was observed. */
  durationMs?: number;
}

/**
 * Build the done-notification body: the outcome plus the run duration.
 *
 * @param outcome - the flow outcome.
 * @param cap - body cap in chars.
 * @returns the summary body.
 */
export function buildDoneBody(outcome: DoneOutcome, cap: number = NOTIFY_BODY_CAP): string {
  const status = outcome.failed
    ? `出错：${capText(outcome.error ?? "未知错误", NOTIFY_ERROR_CAP)}`
    : "已完成";
  const duration = outcome.durationMs !== void 0 ? `（耗时 ${formatDuration(outcome.durationMs)}）` : "";
  return capText(status + duration, cap);
}

export interface AgentRunRecord {
  startedAt: number;
  failed: string | null;
}

/**
 * Per-agent flow tracker: remembers who is running, records observed errors,
 * and reports the one transition that matters — a flow ending. No-op status
 * repeats (the harness invariant forbids them, but listeners must be
 * tolerant) and idle events without a tracked start are ignored.
 */
export interface FlowTracker {
  onStatus(agentId: string, status: "idle" | "running", now?: number): { kind: "ended"; record: AgentRunRecord } | null;
  onError(agentId: string, message: string): void;
}

/** Create a fresh flow tracker (module-level state lives in the wiring). */
export function createFlowTracker(): FlowTracker {
  const agents = new Map<string, AgentRunRecord>();
  return {
    onStatus(agentId, status, now = Date.now()) {
      if (status === "running") {
        if (agents.has(agentId)) return null; // already running — keep the original start
        agents.set(agentId, { startedAt: now, failed: null });
        return null;
      }
      const record = agents.get(agentId);
      if (record === void 0) return null;
      agents.delete(agentId);
      return { kind: "ended", record };
    },
    onError(agentId, message) {
      const record = agents.get(agentId);
      if (record === void 0) return;
      record.failed = capText(message, NOTIFY_ERROR_CAP);
    }
  };
}
