# Changelog

All notable changes to **better-deepseek-harness** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
For the Chinese version, see [CHANGELOG_ZH.md](CHANGELOG_ZH.md).

## [Unreleased]

- Nothing yet.

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

[Unreleased]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.6.0
[0.5.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.5.0
[0.4.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.4.0
[0.3.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.3.0
[0.2.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.2.0
[0.1.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.1.0
