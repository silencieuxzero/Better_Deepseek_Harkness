# better-deepseek-harness

> The project name pays tribute to Minecraft mods (?) — "better" Nether/End/Advancements/Anvil/FPS/Dungeons/Villages/Mending/F3/Leaves/Animal AI/PVP/HUD/Survival/Combat/Latency Display/Enchantments/Totems/Loot/Sodium video settings button...

A plugin written for the DeepSeek Harness Web UI: install, uninstall and enable/disable **Skills** and **Plugins** directly from **Settings → Better DeepSeek Harness**, and wire the plugin's own preferences into the native settings system (the `ext-center` section of `settings.yaml`).

> 中文版说明见 [README.md](README.md)。

## Table of Contents

- [Features](#features)
- [Compatibility (dsh-web-ui)](#compatibility-dsh-web-ui)
- [Installation](#installation)
- [Deployment Configuration (the `config` block of the `ext-center` row)](#deployment-configuration-the-config-block-of-the-ext-center-row)
- [Usage](#usage)
- [HTTP API (host-side, prefix /ext/api)](#http-api-host-side-prefix-extapi)
- [Troubleshooting](#troubleshooting)

> Want to understand the internals, develop on, or contribute to this plugin? See [CONTRIBUTING.md](CONTRIBUTING.md) (implementation notes, directory structure, development and testing workflow).

## Features

<details>
<summary>Click to expand the feature list</summary>

### Plugin & Skill Management

**Skill management**

- List installed skills (name / description / applicable scenarios / path)
- Three install sources:
  - Paste Markdown (with `---` frontmatter; `name` and `description` are required)
  - Download a Markdown file from a URL
  - A local file or directory path (directories must contain `SKILL.md`)
- Install location: `~/.dsh/skills` (discovered live by the skill filesystem provider — no restart needed)

**Plugin management**

- List plugins installed through this plugin (version / source / config-line count / enabled state)
- Four sources: npm package name (via the npm registry), `.tgz` tarball URL (built-in tar extraction, no external tools), local directory, Git repository
- After installation the profile's `cordis.patch.yml` is written and **hot-applied by the HMR config listener — no restart**; plugins with a client UI appear after a page refresh
- Enable / disable / uninstall (also hot-applied)
- Read-only listing of current loader entries (id / state / enabled)

### Settings & Preferences (Settings Page)

**Native settings** (the `ext-center` section of `settings.yaml`)

| Setting | Description |
| --- | --- |
| `allowLan` | Whether to allow LAN access to `/ext/api` (both read and write: mutation endpoints as well as loopback endpoints such as the file tree / terminal output / Git reads / MCP list; loopback-only by default) |
| `skillRoot` | Skill install root directory (empty = `~/.dsh/skills`) |
| `customSkillDirs` | Extra skill directories, one per line; skills there are provided to all sessions through a provider registered by this plugin |
| `treeRoot` | Sidebar file tree root (empty = most recently registered workspace, otherwise the process working directory) |

**MCP servers**: the "MCP" tab on the settings page

- Add custom MCP servers (`stdio` local command / `streamable-http` remote URL; supports args, environment variables, working directory, request headers and a tool-call timeout)
- Each server is written as one `@deepseek-ai/dsh-mcp-client` row (id `ext-center.mcp.<name>`) in `cordis.patch.yml` and **hot-applied** by the config listener
- The list shows live loader status (running / failed / disabled) with enable / disable / remove actions
- Server tools are exposed to the model as `mcp__<name>__<tool>`; hand-written external MCP rows are shown read-only

**Image transcription**: the "Image Transcription" configuration on the settings page

- When enabled, model requests that contain images are first described by the vision model you choose (provider / model / prompt / per-request cap 1–8, bounded by the deployment cap) through the `llm/stream` waterfall, before text-only adapters see them — only the image blocks of the current request are replaced; the recorded conversation keeps the original images. A failed transcription degrades automatically to placeholder text (with dsh-web-ui's `dsh-tool-describe-image` installed and ACTIVE, this feature stands down — see "dsh-web-ui compatibility")
- The provider dropdown is populated from the registered LLM routes (the `llmProviders` of `/ext/api/state`); you can also pick "custom route" and fill in an OpenAI-compatible `chat/completions` API URL
- The custom route supports an **API Key** (password input on the settings page, write-only, never echoed; saving with an empty field keeps the previous value); transcription requests carry an `Authorization: Bearer <key>` header, and `/ext/api/state` only reports the `apiKeyConfigured` boolean — never the key itself
- The **transcription output cap (tokens)** is adjustable on the settings page (64–8192; empty = the deployment default `vision.maxTokens`; raise it for reasoning models)
- **Enabling the switch lifts the host api-gateway image-admission restriction**: the host rejects models that do not support images per the current model's `inputModalities` (raising `MODEL_DOES_NOT_SUPPORT_IMAGES`); when the switch is on, the plugin declares the current model as supporting image input (wrapping `llm.resolveModelInfo`, only appending the `image` modality); when off, nothing is changed and the host's native validation stays untouched

**Tavily search**: the "Tavily" tab on the settings page (`ext-center.tavily`)

- Options:
  - **API Key**: required; password field with show/hide toggle, write-only, never echoed; saving with an empty field keeps the previous value; format-validated on save (must start with `tvly-` and be at least 20 characters)
  - **Search depth**: basic / advanced
  - **Max results**: 1–10, default 5
  - **Include raw content**: toggle; when on, each source carries its raw page content (truncated to 4000 characters)
  - **Enable search**: master switch
- One-click save plus "Reset · Tavily" to restore defaults
- Integration: when enabled, a `tavily_search` tool is registered for the model and a system-prompt hint tells it to call it automatically whenever it needs real-time information (news, prices, recent events) or cannot answer confidently; results (summary + source list + raw content) are injected for reference, and sources are cited on request
- Graceful degradation: when the master switch is off, the API key is missing, or a call fails, a clear error is returned (turned into a tool error result by the agent loop) and the model answers from its own knowledge — **normal replies are never blocked**; switch changes take effect live (settings `watch` registers / deregisters the tool and the prompt hint — no restart)

**GitHub repository access**: the "GitHub" tab on the settings page (`ext-center.github`)

- Options:
  - **Token (optional)**: password field with show/hide toggle, write-only, never echoed; saving with an empty field keeps the previous value; format-validated on save (must start with `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` / `github_pat_` and be at least 20 characters)
  - **Enable GitHub tools**: master switch (default on — public repositories need no token)
- Integration: when enabled, five tools are registered for the model with a system-prompt hint:
  - `github_repo`: repository metadata (description / stars / forks / default branch / language / license / topics)
  - `github_tree`: directory listing (files and subdirectories with sizes; a file path is answered with a pointer to `github_file`)
  - `github_file`: file content (base64-decoded, capped at 64 KiB; binary files are flagged; a directory path is answered with a pointer to `github_tree`)
  - `github_search`: repository search (GitHub search syntax, e.g. `topic:rust stars:>1000`, 1–10 results)
  - `github_releases`: recent releases (tag / name / date / release notes, notes truncated to 4000 characters)
- Safety and graceful degradation: without a token calls are unauthenticated (60 requests/hour/IP, fixed `x-github-api-version: 2022-11-28` header); 401 (invalid token) / 403 (rate limit) / 404 errors map to readable messages turned into tool error results by the agent loop — **normal replies are never blocked**; when the master switch is off or a call fails, the model answers from its own knowledge; switch changes take effect live (settings `watch` registers / deregisters — no restart)

**Windows notifications**: the "Notifications" tab on the settings page (`ext-center.notify`, Windows only)

- Native Windows toasts (nothing to install) that pop even while the app is in the background or unfocused:
  - **Notify when asking**: a toast pops when the model calls `ask_user_question` and waits for your input, with a question summary (truncated)
  - **Notify when a flow ends**: a toast pops when a root-agent flow finishes (running → idle), with the outcome (completed / failed + error summary) and the run duration; sub-agent flows and internal maintenance phases never notify
- Options (all toggleable on the settings page, stored in the `ext-center.notify` section of settings.yaml):
  - **Enable Windows notifications**: master switch (default on)
  - **Notify when asking** / **Notify when a flow ends**: two sub-switches
- Implementation: when the host runs under Electron, the Electron main-process `Notification` is used; otherwise a WinRT `ToastText02` toast is shown through `powershell.exe -EncodedCommand` (single-quoted literal escaping + `CreateTextNode` injection — no injection surface; 15 s spawn timeout backstop). Notification failures only log — they **never block the agent loop or tool dispatch**; non-Windows platforms no-op automatically

### Conversation & Sidebar

**Sidebar file tree**: the "File Tree" button at the bottom of the sidebar

- Workspace file browsing (`GET /ext/api/tree`), expanding directories level by level: directories show their child count, files show their size, each row has a one-click path copy; supports collapse-all
- Root directory: the `treeRoot` setting (empty = most recently registered workspace, otherwise the process working directory)
- Click a file to open it in a modal editor with save (existing files inside the tree root only, 1 MiB cap, binary / NUL protection); clicking outside the panel or pressing Esc collapses it automatically

**Archived conversation management**: the "Archive" button at the bottom of the sidebar

- Lists all currently archived sessions (title / workspace / updated time); checkboxes allow batch **permanent deletion** (confirmation required; sessions still running / loading are skipped and reported)
- Deletion is performed host-side by `/ext/api/archive/delete`: it removes the corresponding JSONL session logs and cleans up the workspace accounting

**Multi-terminal**: the "Terminal" tab on the conversation page (`conversation.view` slot)

- Create your own **CMD** or **PowerShell** terminals, multiple at once (concurrency cap configurable, default 8)
- Active terminal on the left (output area + command input line + interrupt button), all terminals listed on the right (switch / close)
- Starts in the workspace (the file-tree root) by default; output is fetched incrementally by polling, and ANSI escape sequences are stripped before they enter the output buffer (colors / cursors / window titles never turn into garbage)
- Based on node-pty (falls back to a plain pipe when missing); all terminal processes are cleaned up on plugin unload

**Git panel**: the "Git" tab on the conversation page (`conversation.view` slot, `ext-center.git`), VSCode "Source Control" style

- Top toolbar: branch dropdown, upstream / ahead / behind badges, pull (`--ff-only`) / push / refresh
- Commit box: multi-line commit message (Ctrl+Enter to commit); the button shows the staged count; disabled with a hint when nothing is staged or a merge conflict exists
- Change groups: staged changes / unstaged changes / untracked files, with VSCode-colored status badges (M/A/D/R/conflict/untracked), rename sources, inline `+ / − / ✕` (stage / unstage / discard with confirmation); group headers "stage all / unstage all"
- Diff view: click a file to see the unified diff (line numbers + add/delete/context/hunk-header coloring); untracked files are rendered as full additions; binary files and oversized diffs get hints; merge conflicts are shown as combined diffs
- Commit history: recent commits (count configurable, default 30; short hash / author / time / subject)
- Auto-refresh of status (interval configurable, default 5 s); the repository is auto-discovered by walking up from the file-tree root for `.git`; all operations run through host-side git subprocesses (`GIT_TERMINAL_PROMPT=0` to prevent hangs)

**Optimize input**: the "Optimize Input" button at the bottom right of the conversation input box (between the send button and the context button; star icon)

- Click it to optimize the input with the currently selected model of the session; the result is written back into the input box, ready to polish the prompt before sending

**dsh-web-ui compatibility**: when installed alongside the dsh-web-ui family, conflicting surfaces stand down automatically (see [Compatibility (dsh-web-ui)](#compatibility-dsh-web-ui)).

### Robustness

**Tool-call argument auto-repair**

- Repairs occasional model argument jitter through a `tools/execute` wrapper:
  - a missing / empty / wrongly typed `description` is filled with a neutral placeholder
  - `arguments` that are broken JSON (truncated, interleaved text, trailing commas) are recovered into an object
- Avoids needless `INVALID_ARGS` errors and keeps conversations flowing

**Rescue mode**

- When DeepSeek Harness fails to start (third-party plugin conflicts, a plugin that was not built, duplicate loader entry ids, ...) rescue mode kicks in automatically:
  - Detection: the previous boot never completed (crashed / exited inside the startup window), a third-party entry failed during startup, or the patch carries duplicate entry ids
  - Every third-party plugin except this one is disabled by default (applied live through `cordis.patch.yml` — no hand editing) and the harness keeps running with the minimal configuration
  - After a successful boot a dialog lists every disabled plugin with its name and reason (when available); pick any subset to re-enable, or choose "Restore all" / "Keep disabled" / "Enable selected & reload"
  - Confirming writes the selection back and reloads (page refresh in the desktop host; process restart in a bare command-line host)
  - This plugin's own features (settings, terminals, git, MCP, vision, Tavily, file tree, ...) are unaffected by rescue mode
  - The Plugins tab also offers an "Enter rescue mode" button to trigger the same flow manually

**Headless / TUI hosts (e.g. dsh-TUI)**

- The plugin loads in terminal hosts whose composition has no `webServer` service, and every GUI-independent feature keeps working:
  - The rescue-mode watchdog and restore flow are fully functional; the interaction surface is the **`/rescue` slash command** (dsh-TUI merges registry commands into its slash menu): `/rescue` shows status, `/rescue apply all|none|<names>` restores a selection, `/rescue trigger` enters rescue mode manually
  - Rescue mode auto-protects the host's own front door (in hosts without a web layer, a third-party bundle that mounts itself as a loader row is never disabled — disabling it would kill the terminal UI with no way to restore); `rescue.protectBundles` appends an explicit protection list
  - The settings namespace, custom skill directories, Tavily search, tool-argument repair and image transcription keep working; only the `/ext/api` HTTP routes and the Web surfaces are not mounted

</details>

## Compatibility (dsh-web-ui)

[dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) is a plugin & skin family for the DeepSeek Harness Web UI (the `@linxin666/*` packages; the `dsh-web-ui-all` aggregate installs the whole family in one shot). Some of its features overlap with this plugin's surfaces: **when elements conflict, this plugin does not load its own corresponding feature — dsh-web-ui's feature takes over**. The stand-down is automatic; no configuration is needed.

### Conflicting surfaces and stand-down rules

| This plugin's surface | dsh-web-ui's counterpart | Stand down while ACTIVE (this plugin's feature is not loaded) |
| --- | --- | --- |
| Sidebar file tree (`ext-center.tree`) | "Files" explorer in the right panel | `@linxin666/dsh-client-ui-aionui-panel` (`ui-dsh-aionui-panel`) |
| Conversation "Git" tab (`ext-center.git`) | "Changes (SCM)" right panel + branch selector / git graph | `dsh-client-ui-aionui-panel` or `@linxin666/dsh-client-ui-git-graph` (`ui-git-graph`) |
| Conversation "Terminal" tab (`ext-center.terminal`) | Web terminal in the "SSH" remote-ops panel | `@linxin666/dsh-ssh` (`ssh`) |
| Image transcription + vision capability bridge | Image understanding (`describe_image` tool + image button in the input box) | `@linxin666/dsh-tool-describe-image` (`describe-image`) |

> Note: dsh-web-ui's `describe-image` rewrites image-bearing sends into text references on the client side, so image blocks never reach the `llm/stream` transcription waterfall — while it is active, this plugin's image transcription and vision capability bridge stay inert, avoiding duplicated vision-model calls.

### Detection and behavior

- **Matches loader entry ids or npm package names** and only counts **ACTIVE (fiber state 2), non-disabled** entries: while a family plugin is pending / failed / disabled it renders no elements, so this plugin keeps its own surface (fail-open).
- **Host side**: the loader tree is snapshotted at `apply()` time and re-checked once the tree converges (up to 8 s) — a sibling bundle may still be pending when this plugin starts, and a late activation also stands down. The transcription listener and capability bridge consult the gate per call and pass requests through untouched when suppressed (the api-gateway's native image-admission check is restored).
- **Browser side**: the file-tree / Git / terminal slot registrations wait for the client loader tree to converge and then register only the non-conflicting surfaces; a missing loader or a broken gate fails open immediately — our surfaces are never hidden.
- **Never affected**: the "Better DeepSeek Harness" settings section, the rescue-mode dialog, the archive panel, the "Optimize input" button, and this plugin's host API endpoints (`/ext/api` — they do not collide with the family's `/git/*` or `/api/dsh-ssh/*`).
- If the family is installed at runtime, its browser half only appears after a page refresh anyway — **the stand-down takes effect after that refresh**.

## Installation

### Method 1: Git install (recommended; requires git, no pnpm / npm)

Clone this repository, then run the one-click install script inside it:

```powershell
git clone https://github.com/silencieuxzero/Better_Deepseek_Harness.git
cd Better_Deepseek_Harness
.\install.ps1                # installs into the web profile by default; other profiles: .\install.ps1 -Profile agents
```

The script copies the package to the shared module root `~/.dsh/profiles/node_modules/better-deepseek-harness` and appends the `ext-center` row (deduplicated by id) to the profile's `cordis.patch.yml`. The config listener hot-applies it within seconds: the host-side API is available immediately, and "Settings → Better DeepSeek Harness" appears after refreshing the browser.

### Method 2: Manual install (no git / pnpm / npm)

Copy the whole `better-deepseek-harness` directory to the shared module root (the directory name of the git clone is `Better_Deepseek_Harness` — copy it under whatever name you actually have):

```powershell
Copy-Item -Recurse Better_Deepseek_Harness "$HOME\.dsh\profiles\node_modules\better-deepseek-harness"
```

Then append to the profile's `cordis.patch.yml` (e.g. `~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: ext-center
      name: better-deepseek-harness
```

The config listener hot-applies it within seconds: the host-side API is available immediately, and "Settings → Better DeepSeek Harness" appears after refreshing the browser.

### Method 3: Official `dsh plugin` flow (requires pnpm)

Local directory (or the directory from method 1):

```bash
dsh plugin --profile web add file:/path/to/better-deepseek-harness
```

You can also install directly from the Git repository (requires git):

```bash
dsh plugin --profile web add git+https://github.com/silencieuxzero/Better_Deepseek_Harness.git
```

The patch file declared in the package's `dsh.bundle.patch` (in `package.json`, i.e. `cordis.patch.yml`) inserts a row with the same id (`ext-center`), which is deduplicated by id against methods 1 and 2 — no conflict.

## Deployment Configuration (the `config` block of the `ext-center` row)

All deployment-tunable behavior is collected in the `config:` block of the `ext-center` row in `cordis.patch.yml`, validated with schemastery: every field carries its own default and legal range, and an illegal value makes the plugin **fail to load with a clear error** (fail loudly rather than drift silently). Safety invariants (request body 2 MiB, file editor 1 MiB, single terminal write 4096 chars, git single-batch paths 500, archive-delete single batch 500, single optimize-input text 100 KiB) stay fixed and are not configurable.

```yaml
- insert:
    - id: ext-center
      name: better-deepseek-harness
      config:
        pluginRoot: ""                  # plugin install root; empty = profile shared module root node_modules
        tree:
          maxEntries: 2000             # max entries returned for a single directory
          ignores: [".git", ".svn", ".hg", "node_modules", ".dsh", "dist",
                    ".next", ".cache", ".turbo", "coverage", "__pycache__",
                    ".DS_Store"]
        terminal:
          maxSessions: 8               # terminal concurrency cap (1-64)
          bufferLimit: 262144          # per-terminal output ring buffer (bytes)
        git:
          timeoutMs: 60000             # single git command timeout (ms)
          diffLimit: 524288            # single-file diff payload cap (bytes; truncated beyond)
          logMax: 30                   # commit history count
        mcp:
          maxServers: 16               # panel-managed MCP server cap
        vision:
          maxImagesCap: 8              # deployment cap for transcribed images per request (the settings-page 1-N is bounded by this)
          maxTokens: 1024              # default token cap per transcription (overridable on the settings page, 64-8192)
        toolRepair:
          enabled: true                # master switch for tools/execute argument repair
          descriptionFill: "Execute tool"   # neutral placeholder text when description is missing
        client:
          terminalPollMs: 300          # browser terminal output poll interval
          terminalListPollMs: 2000     # browser terminal list poll interval
          gitPollMs: 5000              # browser git status poll interval
          mcpPollMs: 3000              # browser MCP list poll interval
        rescue:
          enabled: true                # rescue mode master switch (on by default)
          settleMs: 12000              # startup window: how long without problems before a boot is healthy (3000-120000)
```

All of the above fields may be omitted (omitting means the default is used); the `config:` block itself may also be omitted. After editing, the config listener hot-applies the change (config is metadata of the `ext-center` row and is likewise replayed by the listener). The Web UI reads these caps from the `limits` block of `/ext/api/state`, and the UI copy ("first 2000 entries", "cap 8", etc.) and poll rhythms follow automatically.

## Usage

1. Open the Web UI → Settings (gear) → **Better DeepSeek Harness**
2. "Skills" tab: fill in a name (lowercase kebab-case) and content / URL / path, click install; list items can be uninstalled
3. "Plugins" tab: pick a source and fill in an npm package name / tarball URL / local directory / Git repository address, click install; installed plugins can be enabled, disabled, uninstalled
4. "Settings" tab: change this plugin's preferences (saved to the `ext-center` section of `settings.yaml`)
5. "Tavily" tab: enter your API Key and turn on "Enable search"; in conversations the model will automatically search for real-time information and cite sources
6. "GitHub" tab: nothing to configure for public repositories; fill in a token and turn on "Enable GitHub tools" for higher rate limits or private repositories — in conversations the model can query repository metadata, list directories, read files, search repositories and list releases
7. "Notifications" tab (Windows): toggle "Notify when asking" and "Notify when a flow ends" as you like — a system toast pops when the model waits for your input or a flow finishes
8. Conversation page: click the star icon "Optimize Input" at the bottom right of the input box (between the send button and the context button); the current model optimizes the input and writes it back into the input box
9. Bottom of the sidebar: click "Archive" to view archived conversations, check them and click "Delete" to batch **permanently** delete (confirmation required; sessions still running / loading are automatically skipped and reported)
10. Rescue mode: enters automatically after a failed Harness boot — once the minimal boot succeeds, a dialog lists the disabled third-party plugins; select some and click "Enable selected & reload", or use "Restore all" / "Keep disabled". You can also trigger it manually with "Enter rescue mode" on the Plugins tab

> Security: all mutation endpoints and read endpoints that expose local paths/output (`/ext/api/state`, the file tree, terminal output, Git reads, the MCP list) are loopback-only by default; to manage over LAN, turn on `allowLan` on the Settings page. Also note: installing from a Git source means running that repository's code — installation/loading and the automatic build (`npm install` executes npm lifecycle scripts declared by that repository) all run its contents, so only install repositories you trust.

## HTTP API (host-side, prefix /ext/api)

> Responses are uniformly `{ok: true, value}` or `{ok: false, error: {code, message}}`.

### State & Configuration

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/state` | Full state: skill list, plugin install records, loader entries, configuration, plus `limits` (the caps and client poll intervals, see "Deployment Configuration") |
| `POST /ext/api/config` | Writes the `ext-center` settings namespace (`allowLan` / `skillRoot` / `customSkillDirs` / `treeRoot` / `vision` / `tavily` / `github` / `notify`) |

### File Tree

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/tree?path=...` | List one level of entries under the root (type / size / mtime / child count, `truncated` flag and `maxEntries` cap); root resolution: `treeRoot` setting → most recently registered workspace → process working directory |
| `GET /ext/api/tree/content?path=...` | Read a text file inside the tree root (rejects directories / oversized / NUL-containing binaries), for the editor |
| `POST /ext/api/tree/write` | `{path, content}` atomically writes back an existing file inside the tree root (temp file + rename; same size and binary protections) |

### Terminal

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/terminal/list` | All terminal sessions (id / kind / cwd / alive / exitCode / createdAt) |
| `POST /ext/api/terminal/create` | `{kind: 'cmd'\|'powershell'}` creates a terminal (cap = `terminal.maxSessions`, default 8; cwd = file-tree root), returns `{id, kind, cwd}` |
| `POST /ext/api/terminal/write` | `{id, data}` writes input (≤ 4096 chars per write; rejects exited terminals) |
| `POST /ext/api/terminal/resize` | `{id, cols, rows}` resizes the terminal (effective in pty mode) |
| `POST /ext/api/terminal/kill` | `{id}` closes a terminal (idempotent) |
| `GET /ext/api/terminal/output?id=..&after=..` | Poll incremental output: `after` is the byte offset the client has read, returns `{alive, exitCode, text, cursor}`; `cursor` is the authoritative stream offset (after ring-buffer truncation the client resets to it instead of incrementing) |

### Git

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/git/status` | Repo root, branch, upstream, ahead/behind, change list (staged / unstaged / untracked / renames / conflict markers) |
| `GET /ext/api/git/diff?path=..&staged=0\|1` | Single-file diff (structured into meta/hunk/ctx/add/del lines with line numbers on both sides; untracked files synthesized as full additions; merge conflicts returned as combined diffs) |
| `GET /ext/api/git/log?n=30` | Recent commits (oid / short / author / time / subject) |
| `GET /ext/api/git/branches` | Branch list (with current marker) |
| `POST /ext/api/git/stage` | `{paths:[...]}` stage (git add) |
| `POST /ext/api/git/stage-all` | Stage everything (git add -A) |
| `POST /ext/api/git/unstage` | `{paths:[...]}` unstage (git restore --staged) |
| `POST /ext/api/git/unstage-all` | Unstage everything (git reset) |
| `POST /ext/api/git/commit` | `{message}` commit (git commit -m) |
| `POST /ext/api/git/discard` | `{paths:[...]}` discard changes (git checkout --; untracked files are deleted directly, directories rejected) |
| `POST /ext/api/git/checkout` | `{branch}` switch branch (whitelist-validated name) |
| `POST /ext/api/git/pull` | Pull (--ff-only; timeout = `git.timeoutMs`, default 60 s) |
| `POST /ext/api/git/push` | Push (timeout = `git.timeoutMs`, default 60 s) |

### MCP

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/mcp/list` | Server list (panel-managed rows + external hand-written rows, with config summary and loader status) and `max` (deployment cap) |
| `POST /ext/api/mcp/add` | `{name, transport, command?, args?, env?, cwd?, url?, headers?, toolCallTimeoutMs?}` adds a server (writes the patch row and hot-applies it) |
| `POST /ext/api/mcp/remove` | `{name}` removes a server (deletes the patch row and hot-applies it) |
| `POST /ext/api/mcp/set-enabled` | `{name, enabled}` enables / disables (patch-row disabled marker) |

### Skills & Plugins

| Endpoint | Description |
| --- | --- |
| `POST /ext/api/skill/install` | `{name, text?\|url?\|path?}` installs a skill |
| `POST /ext/api/skill/uninstall` | `{name}` uninstalls a skill |
| `POST /ext/api/plugin/install` | `{source: {kind: 'npm'\|'url'\|'folder'\|'git', spec?\|url?\|path?}}` installs a plugin |
| `POST /ext/api/plugin/uninstall` | `{name}` uninstalls a plugin (removes the patch row + package directory) |
| `POST /ext/api/plugin/set-enabled` | `{name, enabled}` enables / disables a plugin |

### Conversation & Archive

| Endpoint | Description |
| --- | --- |
| `POST /ext/api/input/optimize` | `{text, provider, model, sessionId?, reasoningEffort?}` optimizes input with the specified (currently selected) model, returns `{text}` |
| `POST /ext/api/archive/delete` | `{ids:[...]}` batch-permanently deletes archived sessions (must belong to the archive set; sessions still running / loading are skipped), returns `{deleted, skipped, count}` |

### Rescue Mode

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/rescue/status` | Current rescue status: `phase` (`idle` / `applied`), `active`, the triggering failure and the disabled third-party plugins with reasons (no row shapes, no secrets) |
| `POST /ext/api/rescue/trigger` | Manually applies rescue mode (disables every third-party plugin except this one) and returns the resulting status |
| `POST /ext/api/rescue/apply` | `{enable:[...]}` applies the user's decision: re-enables the selected plugins, keeps the rest disabled, marks the boot healthy, then reloads (`none` for an empty selection, `page` in the desktop host, `process` in a bare host) |

## Troubleshooting

- **Changes not hot-applied**: changes to `cordis.patch.yml` are applied by the harness's config listener (HMR). If you make several changes in quick succession (e.g. install then immediately disable) and trigger a listener race, the config listener may stall — restart `dsh web` once to recover (the patch file itself is correct and loads normally after restart). This plugin's writes are serialized with an interval to avoid that situation as much as possible.
- **Settings-page section not visible**: refresh the browser page (the client bundle is injected by the boot manifest and loads on refresh).
- **Settings page stuck on "Loading…" / no image-transcription options**: the settings page now reads and writes through this plugin's own `/ext/api/state` and `/ext/api/config` and no longer depends on whether api-proxy exposes `ext-center`. If an old version is still loading, upgrade, restart `dsh web` and refresh the page; if only the old version is available, check the host log to confirm the `ext-center` settings namespace is registered.
- **Install fails with git-unavailable**: git is not installed locally; switch to the directory / tarball URL / npm package name sources.
- **Install fails with build-failed / build-tool-missing**: the Git source repository does not commit its built output and the automatic build failed (or npm is missing locally). First confirm `npm` works and can reach the registry; if the repository declares no `build` script or the entry file is still missing after the build, install that package through its npm package name / tarball URL instead.
- **Install fails with `EPERM: Permission denied` (Windows, path pointing at `.dsh-ext-center-staging`)**: on Windows, deleting a directory that another process briefly holds open (AV real-time scan of a freshly cloned repo, file watchers, ...) returns EPERM. This plugin now retries staging cleanup and target replacement internally (`maxRetries: 5`), so transient locks are skipped automatically; if it keeps recurring the lock is persistent — add `~/.dsh` to Windows Security exclusions, or restart once and retry (a leftover staging directory can be deleted by hand; it holds no data).
- **Startup error `[better-deepseek-harness] invalid config on the ext-center row ...`**: the `config:` block of the `ext-center` row in `cordis.patch.yml` has an illegal value (out of range or wrong type). Fix it per the "Deployment Configuration" section, or simply delete the `config:` block (everything falls back to defaults) and restart.
- **Harness fails to start (plugin conflict / third-party plugin not built)**: restart the application once — on the next boot rescue mode automatically disables the offending third-party plugins and starts with the minimal configuration, then shows a dialog to pick which plugins to restore. If you chose "Keep disabled" and later want them back, re-enable them on the Plugins tab or edit `cordis.patch.yml` by hand to delete the `disabled: true` markers (the rescue record lives in the profile's `.dsh-rescue.json`).
- **Occasional `invalid arguments: missing required property ...`**: the model occasionally generates tool arguments with missing fields or broken JSON. This plugin's `tools/execute` wrapper automatically repairs a missing `description` and recoverable JSON; calls genuinely missing `code` / `command` content still error out through DSH's native mechanism and make the model retry — that is normal feedback.
