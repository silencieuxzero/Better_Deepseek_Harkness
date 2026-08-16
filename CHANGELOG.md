# Changelog

All notable changes to **better-deepseek-harness** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
For the Chinese version, see [CHANGELOG_ZH.md](CHANGELOG_ZH.md).

## [Unreleased]

### Added

- **Windows notifications** (Windows only): native system toasts that pop even while the app is in the background or unfocused, with a new "Notifications" tab on the settings page (`ext-center.notify`):
  - **Notify when asking**: a toast pops when the model calls `ask_user_question` and waits for input, with a question summary (truncated);
  - **Notify when a flow ends**: a toast pops when a root-agent flow finishes (running → idle), with the outcome (completed / failed + error summary) and the run duration; sub-agent flows and internal maintenance phases never notify;
  - Options: `enabled` (master switch, default on) / `onQuestion` / `onDone`, stored in the `ext-center.notify` section of settings.yaml;
  - Implementation: when the host runs under Electron, the Electron main-process `Notification` is used; otherwise a WinRT `ToastText02` toast is shown through `powershell.exe -EncodedCommand` (single-quoted literal escaping + `CreateTextNode` injection, 15 s spawn timeout backstop). Notification failures only log — they never block the agent loop or tool dispatch; non-Windows platforms no-op automatically.
  - Pure logic in `src/notify.ts` (settings resolution, platform gate, text capping & escaping, message building, toast-script building, agent-flow tracker), with host side effects injected through `__setNotifyHostHooks`; covered by `tests/notify.spec.ts` and new `tests/host-wiring.spec.ts` cases.
- **GitHub repository access** through the GitHub REST API, with a new "GitHub" tab on the settings page (`ext-center.github`):
  - five model-facing tools registered with a system-prompt hint: `github_repo` (metadata: description / stars / forks / default branch / language / license / topics), `github_tree` (directory listing with sizes; a file path answers with a pointer to `github_file`), `github_file` (content: base64-decoded, capped at 64 KiB, binary-flagged; a directory path answers with a pointer to `github_tree`), `github_search` (repository search with GitHub query syntax, 1–10 results), `github_releases` (recent releases; notes truncated to 4000 characters);
  - **optional token**: public repositories work unauthenticated (60 requests/hour/IP); the settings password field is write-only (format-validated, `ghp_` / `github_pat_` etc.; `/ext/api/state` only reports the `tokenConfigured` boolean); 401 / 403 (rate limit) / 404 errors map to readable messages;
  - on by default (public repos need no configuration), with a master switch; changes apply live through the settings `watch`; failures never block an answer (the model falls back to its own knowledge).
  - Pure logic in `src/github.ts` (settings resolution, token validation, owner/repo & path parsing, endpoint URL building, response mapping, error mapping, output formatting), covered by `tests/github.spec.ts` and new `tests/host-wiring.spec.ts` cases.
- **dsh-TUI / headless-host support**: full support for terminal hosts whose composition has no `webServer` service (e.g. [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI)); every GUI-independent feature keeps working:
  - `webServer` is now an optional service (static inject keeps only `tools`): the plugin loads in web-less hosts — rescue watchdog, settings namespace, custom skill directories, Tavily search, tool-argument repair and image transcription all work; only the `/ext/api` routes are not mounted;
  - **`/rescue` slash command**: registered automatically when a `commands` registry is mounted (dsh-TUI merges registry commands into its slash menu) — `/rescue` (status), `/rescue apply all|none|<names>` (restore selection; empty = keep disabled), `/rescue trigger` (manual entry). Restoration runs through the exact same pure functions as the Web dialog;
  - **front-door bundle auto-protection**: in hosts without `webServer`, a third-party bundle that mounts itself as a loader row (an insert entry whose `name` equals its own package name) is treated as the host UI itself and never disabled by rescue — otherwise rescue would kill the terminal UI with no dialog to restore from; explicit `rescue.protectBundles` appends to the protected list;
  - Config: `rescue.protectBundles` (string array, default empty) on the `ext-center` row. `buildRescuePlan` in `src/rescue.ts` gained the `protectLayerNames` parameter, covered by new `tests/rescue.spec.ts` and `tests/host-wiring.spec.ts` cases.
- **Rescue mode**: when DeepSeek Harness fails to start (plugin conflicts, an unbuilt third-party plugin, duplicate loader entry ids, or a boot that crashed before settling), the next boot automatically enters rescue mode:
  - every third-party plugin except this one is disabled by default (patch rows get `disabled: true`; third-party profile bundles get id-targeted disable rows) and the harness keeps running with the minimal configuration — no manual patch editing;
  - once the boot succeeds, a dialog lists every disabled plugin (name + disable reason, including the loader's own failure text when available) with multi-select re-enable, plus "Restore all" / "Keep disabled" quick actions;
  - the user's choice is written back through the same transactional patch writer and the harness reloads (page refresh in the desktop host, process respawn in a bare `dsh web` host);
  - this plugin's own functionality is never affected (its own row and every harness-core row are never disabled; all features keep working);
  - a manual "Enter rescue mode" button on the Plugins tab triggers the same flow.
  - Config: `rescue.enabled` (default true) and `rescue.settleMs` (startup settle window, default 12000) on the `ext-center` row; sidecar state lives in the profile's `.dsh-rescue.json`. Pure logic in `src/rescue.ts` (state machine, startup-problem detection, disable/restore plans), covered by `tests/rescue.spec.ts` and new `tests/host-wiring.spec.ts` cases.
- **dsh-web-ui compatibility**: when the dsh-web-ui family (https://github.com/zhu1090093659/dsh-web-ui) is installed and ACTIVE in the same profile, this plugin stands down the surfaces the family owns instead of fighting over the same UI element:
  - the sidebar file tree and the conversation Git tab stay unregistered while `@linxin666/dsh-client-ui-aionui-panel` (explorer / SCM right panel) or `@linxin666/dsh-client-ui-git-graph` is active;
  - the conversation Terminal tab stays unregistered while `@linxin666/dsh-ssh` is active;
  - the host-side image transcription and the vision capability bridge stay inert while `@linxin666/dsh-tool-describe-image` is active (it owns image understanding there);
  - detection is by loader entry id or package name and only counts ACTIVE, non-disabled fibers — a pending or failed family plugin keeps this plugin's own surface; the host gate re-checks once the loader tree settles. Pure logic in `src/compat.ts` (family registry, detection, suppression mapping), mirrored inline in `src/client.js`, covered by `tests/compat.spec.ts`, `tests/compat-client.spec.ts` and new `tests/host-wiring.spec.ts` cases.

### Changed

- **`lib/` is no longer committed to git**: the build output is generated on demand (`npm install` runs `prepare`; `npm test` runs `pretest`; `install.ps1` runs `npm ci` + build; `dsh plugin` uses the package `prepare` hook). `.gitignore` now ignores `lib/`, and the install/docs/tests have been updated accordingly.

### Fixed

- **Settings page no longer shows a bogus "HTTP 200" error after a restart**: `/ext/api` route mounting no longer relies on a one-shot `ctx.get("webServer")` at apply time. The include-loaded fiber can apply before the web-app composition activates its `webServer` service (a boot race), which silently dropped every `/ext/api` route — the settings page then received the SPA's HTML fallback (HTTP 200) and reported "HTTP 200" after a failed JSON parse. The routes now mount eagerly when the service is ready and otherwise wait on the `internal/service` event (re-emitted on activation and replacement, so a webServer hot-reload re-mounts them too); headless hosts are unaffected (no pending fiber, same skip behavior, one delayed log line). The client also reports the failing URL instead of a bare status code.
- **Optional-service mounts are now boot-race safe across the board**: the `/rescue` command (`commands` registry) and the custom-skill provider (`skills` service) used the same one-shot `ctx.get()` pattern and could silently never register when their service started after this fiber. All three surfaces now share one `whenService` helper (immediate mount when ready, `internal/service` wait otherwise).
- **Rescue plan is revised once the settle window reveals the real host shape**: an apply-time plan computed before `webServer` came up could over-protect self-mounted third-party bundles in a web host (mistaken for headless) — the settle check now re-runs the same planner with the settled service status and hot-applies only the delta. Relatedly, duplicate-id detection now counts only inserted entries and bundle-layer ids: standalone patch rows are id-targeted overrides, so rescue's own `{ id, disabled: true }` rows no longer flag every rescued bundle as a duplicate — which previously kept the boot from ever being marked healthy.
- **Settings tabs surface load failures**: the Settings / Tavily / GitHub / Notifications tabs now show the error instead of staying on "loading" forever when `/ext/api/state` fails.
- **Git-source installs now build missing artifacts**: when a repository does not commit its build output (no `lib/` at all — unbuilt source), installation no longer yields a broken package. After cloning, the declared entry (`main` / `exports`) is checked; if missing, `npm install` + `npm run build` run automatically (10-minute per-step cap; failures surface a clear error with the output tail; a missing npm reports `build-tool-missing`). The success message notes that the package was built from source.
- **Tavily toggling re-registers cleanly**: turning the Tavily master switch off and back on now re-registers the `tavily_search` tool and its prompt hint (previously the first disable permanently deactivated the sync).
- **MCP form validation no longer locks the panel**: an invalid timeout / env / header entry now shows the error without leaving every control disabled.
- **`install.ps1` keeps the appended row on its own line**: when the profile's `cordis.patch.yml` does not end with a newline, the installer inserts one before appending the `ext-center` row instead of gluing it to the last YAML line.
- **English README synced** with the rescue-mode additions (features, deployment config, usage, HTTP API, troubleshooting).

## [0.6.0] - 2026-08-15

### Added

- **Tavily web search integration** with a dedicated settings tab (`ext-center.tavily`):
  - API key (password field with show/hide toggle, write-only, format-validated against the `tvly-` prefix, at least 20 characters);
  - search depth (`basic` / `advanced`), max results (1–10, default 5), include-raw-content toggle (raw page content truncated to 4000 chars), and a master enable switch;
  - when enabled, a `tavily_search` tool is registered for the model and a system-prompt hint tells it to search whenever it needs fresh information (news, prices, recent events) or is not confident; results (summary + source list + raw content) are injected for reference with source citation;
  - graceful degradation: disabled, missing key, or failed calls return a clear error that the agent loop turns into a tool error result — the model answers from its own knowledge and normal replies are never blocked; the switch takes effect live via settings `watch` (no restart).
- **Custom vision transcription endpoint** (`2c58c47`): besides choosing a provider from the registered LLM routes, you can pick "custom route" and fill in an OpenAI-compatible `chat/completions` API URL.
  - **Vision API key support** (`9445b22`): password input on the settings page, write-only, never echoed; saved requests carry `Authorization: Bearer <key>`; `/ext/api/state` only reports the `apiKeyConfigured` boolean.
  - **`vision.maxTokens` user override** (`96192c1`): adjustable on the settings page (64–8192; empty = deployment default `vision.maxTokens`).
- **api-gateway image admission bridge** (`b44cf52`): while transcription is enabled, the plugin wraps `llm.resolveModelInfo` to append the `image` modality to the current model, so image-bearing requests reach the transcription waterfall instead of being rejected with `MODEL_DOES_NOT_SUPPORT_IMAGES`; turning the switch off restores the host's native validation untouched.
- **Archived conversation management** (`11f4c49`): sidebar "Archive" action lists archived sessions (title / workspace / updated time); checkboxes allow batch **permanent deletion** with a confirmation dialog (still-running / loading sessions are skipped and reported); deletion is performed host-side by `/ext/api/archive/delete`, which removes the JSONL session logs and detaches workspace accounting.
- **Terminal ring buffer** (`3648665`): per-terminal output is stored in a bounded byte ring (`terminal-buffer.ts`) with truncation-safe incremental byte offsets; ANSI escape sequences are stripped before entering the buffer (`44071de`), so colors / cursors / window titles never leak into the output as garbage.

### Changed

- Repo restructured to Harness package conventions (`82623aa`): `src/` source, `tests/` vitest specs, `docs/` architecture & development docs, committed `lib/` build artifacts; `npm run typecheck / test / build / check`.
- The ext-center settings section is placed directly below the AGENT presets in the settings page (`6324e3a`).
- Settings are now written through the plugin's own `/ext/api/state` + `/ext/api/config` (`5e3d086`, `da3c394`); the `ext-center` settings namespace is registered only after the settings service starts (`ctx.inject(["settings"])`), so the namespace survives even when the plugin boots before the settings service.
- The Git tab is scoped to the current session workspace (`42b5675`).
- README feature list made collapsible (`13a6daf`), then the whole README layout was restructured (`cac6773`).

### Fixed

- Plugin install paths repaired and route handling hardened (`4544298`).
- `llm/stream` vision wrapper now returns an async iterable, matching the waterfall contract (`da3c394`).
- Custom vision transcriptions fall back to the `reasoning` field when the model provides no content (`7a104dd`); endpoint error details are surfaced in the fallback text (`0c19301`).
- Save/reset actions added to the image-transcription card (`d2629d7`).
- "Optimize input" no longer returns an empty result when the model reply is empty (`11f4c49`).
- Archive sidebar layout refined: archive and file-tree actions stacked vertically, archive above the file tree (`ea61c94`, `2e13d0b`, `fd7fd79`).
- Self-audit hardening: optional service lookups guarded, helpers deduped, stale names removed, docs synced (`a86f84e`, `3648665`).

## [0.5.0] - 2026-08-14

### Added

- **Configurable image transcription** (`8a5d0e2`): when enabled, model requests that contain images are first described by a user-chosen vision model (provider / model / prompt / per-request cap 1–8, bounded by the deployment cap) through the `llm/stream` waterfall, before text-only adapters ever see them. Only the image blocks of the current request are replaced — the recorded conversation keeps the original images. A failed transcription degrades automatically to a placeholder text.
- The provider dropdown is populated from the registered LLM routes (exposed by `/ext/api/state` as `llmProviders`).

## [0.4.0] - 2026-08-14

### Added

- **MCP tab** in the settings page (`8afd228`): user-defined MCP servers as live `dsh-mcp-client` rows.
  - Add a server with `stdio` (local command) or `streamable-http` (remote URL) transport, including args, environment variables, working directory, request headers and a tool-call timeout;
  - each server is written as an `@deepseek-ai/dsh-mcp-client` row (id `ext-center.mcp.<name>`) in `cordis.patch.yml` and hot-applied by the config listener;
  - the list shows live loader status (running / failed / disabled) with enable / disable / remove actions;
  - server tools are exposed to the model as `mcp__<name>__<tool>`; hand-written external MCP rows are shown read-only.

## [0.3.0] - 2026-08-14

### Added

- **Git panel tab** (`d2eebe7`): VSCode-style Source Control in the conversation view (`conversation.view` slot, `ext-center.git`).
  - Toolbar: branch dropdown with ahead/behind badges, pull (`--ff-only`) / push / refresh;
  - commit box (Ctrl+Enter to commit, staged count shown; disabled with a hint when nothing is staged or a merge conflict exists);
  - change groups: staged / unstaged / untracked with VSCode-colored status badges (M/A/D/R/conflict/untracked), rename sources, inline `+ / − / ✕` (stage / unstage / discard with confirmation), group-level stage-all / unstage-all;
  - diff view: unified diff with line numbers, add/delete/context/hunk-header coloring; untracked files rendered as full additions; binary files and oversized diffs get hints; merge conflicts shown as combined diffs;
  - commit history (count configurable, default 30; short hash / author / time / subject);
  - status auto-refresh (interval configurable, default 5 s); the repo is auto-discovered by walking up from the file-tree root for `.git`; all operations run through host-side git subprocesses with `GIT_TERMINAL_PROMPT=0` to prevent hangs.

## [0.2.0] - 2026-08-14

### Added

- **Auto-repair of model tool-call arguments** (`5145e5e`) via a `tools/execute` wrapper: fixes transient `INVALID_ARGS` failures by repairing `description` (missing / empty / wrong type → neutral placeholder) and recovering broken JSON `arguments` (truncated, interleaved text, trailing commas) into an object. Only safe fields are touched — `code` / `command` style content fields are never fabricated; `toolRepair.enabled` turns the whole layer off, `descriptionFill` swaps the placeholder text.
- **Multi-terminal tab** (`5f15400`): create and run multiple **CMD** / **PowerShell** sessions side by side (node-pty; plain-pipe fallback when node-pty is missing; concurrency cap configurable, default 8).
  - active terminal pane (output + command input + interrupt) on the left, terminal list (switch / close) on the right;
  - output fetched incrementally by polling; ANSI sequences stripped before they reach the buffer (`44071de`-precursor work in this release);
  - VS Code-style theme-aware rendering (`fdfcfdf`); write-after-exit guarded — pty writes after termination no longer surface raw TypeErrors (`c73fb6e`, `term-write` error code); all terminal processes cleaned up on plugin unload;
  - terminal tab moved to the conversation page next to Trajectory (`conversation.view` slot) (`8a6645a`).
- **Sidebar file tree polish**:
  - `treeRoot` setting; directory child counts, file sizes, one-click path copy, collapse-all, truncation guard (`4fdfd5b`);
  - defaults to the most recent registered workspace, falling back to the process cwd (`3125e7a`);
  - auto-close on outside click or Escape (`bb7f853`);
  - click a file to open an editor modal with save — `GET /ext/api/tree/content` + `POST /ext/api/tree/write` endpoints (`74d97b4`), editor enlarged to a 16:9 area (`min(1024px, 94vw)`) (`da78517`).
- Repo self-audit (`0e481b8`): version derived from `package.json`, stale `dsh-extension-center` names fixed, dead client code removed, duplicate CSS merged, `install.ps1` quoting fixed, `tool-args` documented.

## [0.1.0] - 2026-08-14

### Added

Initial release.

- **Skill management** in the Web UI settings page (「设置 → 更好的 DeepSeek Harness」):
  - list installed skills (name / description / applicable scenarios / path);
  - three install sources: paste Markdown (with `---` frontmatter; `name` and `description` required), download a Markdown file from a URL, local file or directory path (directories must contain `SKILL.md`);
  - installed to `~/.dsh/skills`, discovered live by the skill filesystem provider (no restart).
- **Plugin management**:
  - list plugins installed through this plugin (version / source / config-line count / enabled state);
  - four sources: npm package name (npm registry), `.tgz` tarball URL (built-in tar extraction, no external tools), local directory, Git repository (`321fc9b`);
  - installs write the profile's `cordis.patch.yml`, hot-applied by the HMR config listener — **no restart**; plugins with a client UI appear after a page refresh;
  - enable / disable / uninstall (also hot), read-only listing of current loader entries (id / state / enabled).
- **Settings** (native settings namespace `ext-center`): `allowLan` (LAN access to `/ext/api` mutation endpoints; loopback-only by default), `skillRoot` (skill install root), `customSkillDirs` (extra skill directories served to all sessions through a registered provider).
- **HTTP API** under `/ext/api` with a unified `{ok: true, value}` / `{ok: false, error: {code, message}}` envelope; uniform route table with loopback checks, 2 MiB body cap, error mapping.
- **One-click install** (`install.ps1`) and manual install path (`321fc9b`), plus the official `dsh plugin` flow via the declared `dsh.bundle.patch`.

[Unreleased]: https://github.com/silencieuxzero/Better_Deepseek_Harness/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.6.0
[0.5.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.5.0
[0.4.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.4.0
[0.3.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.3.0
[0.2.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.2.0
[0.1.0]: https://github.com/silencieuxzero/Better_Deepseek_Harness/releases/tag/v0.1.0
