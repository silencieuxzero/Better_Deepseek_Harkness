# better-deepseek-harness

> The project name pays tribute to Minecraft mods (?) — "better" Nether/End/Advancements/Anvil/FPS/Dungeons/Villages/Mending/F3/Leaves/Animal AI/PVP/HUD/Survival/Combat/Latency Display/Enchantments/Totems/Loot/Sodium video settings button...

A plugin written for the DeepSeek Harness Web UI: install, uninstall and enable/disable **Skills** and **Plugins** directly from **Settings → Better DeepSeek Harness**, and wire the plugin's own preferences into the native settings system (the `ext-center` section of `settings.yaml`).

> 中文版说明见 [README.md](README.md)。

## Table of Contents

- [Features](#features)
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

- When enabled, model requests that contain images are first described by the vision model you choose (provider / model / prompt / per-request cap 1–8, bounded by the deployment cap) through the `llm/stream` waterfall, before text-only adapters see them — only the image blocks of the current request are replaced; the recorded conversation keeps the original images. A failed transcription degrades automatically to placeholder text
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

### Robustness

**Tool-call argument auto-repair**

- Repairs occasional model argument jitter through a `tools/execute` wrapper:
  - a missing / empty / wrongly typed `description` is filled with a neutral placeholder
  - `arguments` that are broken JSON (truncated, interleaved text, trailing commas) are recovered into an object
- Avoids needless `INVALID_ARGS` errors and keeps conversations flowing

</details>

## Installation

### Method 1: Git install (recommended; requires git, no pnpm / npm)

Clone this repository, then run the one-click install script inside it:

```powershell
git clone https://github.com/silencieuxzero/Better_Deepseek_Harkness.git
cd Better_Deepseek_Harkness
.\install.ps1                # installs into the web profile by default; other profiles: .\install.ps1 -Profile agents
```

The script copies the package to the shared module root `~/.dsh/profiles/node_modules/better-deepseek-harness` and appends the `ext-center` row (deduplicated by id) to the profile's `cordis.patch.yml`. The config listener hot-applies it within seconds: the host-side API is available immediately, and "Settings → Better DeepSeek Harness" appears after refreshing the browser.

### Method 2: Manual install (no git / pnpm / npm)

Copy the whole `better-deepseek-harness` directory to the shared module root (the directory name of the git clone is `Better_Deepseek_Harkness` — copy it under whatever name you actually have):

```powershell
Copy-Item -Recurse Better_Deepseek_Harkness "$HOME\.dsh\profiles\node_modules\better-deepseek-harness"
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
dsh plugin --profile web add git+https://github.com/silencieuxzero/Better_Deepseek_Harkness.git
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
```

All of the above fields may be omitted (omitting means the default is used); the `config:` block itself may also be omitted. After editing, the config listener hot-applies the change (config is metadata of the `ext-center` row and is likewise replayed by the listener). The Web UI reads these caps from the `limits` block of `/ext/api/state`, and the UI copy ("first 2000 entries", "cap 8", etc.) and poll rhythms follow automatically.

## Usage

1. Open the Web UI → Settings (gear) → **Better DeepSeek Harness**
2. "Skills" tab: fill in a name (lowercase kebab-case) and content / URL / path, click install; list items can be uninstalled
3. "Plugins" tab: pick a source and fill in an npm package name / tarball URL / local directory / Git repository address, click install; installed plugins can be enabled, disabled, uninstalled
4. "Settings" tab: change this plugin's preferences (saved to the `ext-center` section of `settings.yaml`)
5. "Tavily" tab: enter your API Key and turn on "Enable search"; in conversations the model will automatically search for real-time information and cite sources
6. Conversation page: click the star icon "Optimize Input" at the bottom right of the input box (between the send button and the context button); the current model optimizes the input and writes it back into the input box
7. Bottom of the sidebar: click "Archive" to view archived conversations, check them and click "Delete" to batch **permanently** delete (confirmation required; sessions still running / loading are automatically skipped and reported)

> Security: all mutation endpoints and read endpoints that expose local paths/output (`/ext/api/state`, the file tree, terminal output, Git reads, the MCP list) are loopback-only by default; to manage over LAN, turn on `allowLan` on the Settings page.

## HTTP API (host-side, prefix /ext/api)

> Responses are uniformly `{ok: true, value}` or `{ok: false, error: {code, message}}`.

### State & Configuration

| Endpoint | Description |
| --- | --- |
| `GET /ext/api/state` | Full state: skill list, plugin install records, loader entries, configuration, plus `limits` (the caps and client poll intervals, see "Deployment Configuration") |
| `POST /ext/api/config` | Writes the `ext-center` settings namespace (`allowLan` / `skillRoot` / `customSkillDirs` / `treeRoot` / `vision` / `tavily`) |

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

## Troubleshooting

- **Changes not hot-applied**: changes to `cordis.patch.yml` are applied by the harness's config listener (HMR). If you make several changes in quick succession (e.g. install then immediately disable) and trigger a listener race, the config listener may stall — restart `dsh web` once to recover (the patch file itself is correct and loads normally after restart). This plugin's writes are serialized with an interval to avoid that situation as much as possible.
- **Settings-page section not visible**: refresh the browser page (the client bundle is injected by the boot manifest and loads on refresh).
- **Settings page stuck on "Loading…" / no image-transcription options**: the settings page now reads and writes through this plugin's own `/ext/api/state` and `/ext/api/config` and no longer depends on whether api-proxy exposes `ext-center`. If an old version is still loading, upgrade, restart `dsh web` and refresh the page; if only the old version is available, check the host log to confirm the `ext-center` settings namespace is registered.
- **Install fails with git-unavailable**: git is not installed locally; switch to the directory / tarball URL / npm package name sources.
- **Install fails with `EPERM: Permission denied` (Windows, path pointing at `.dsh-ext-center-staging`)**: on Windows, deleting a directory that another process briefly holds open (AV real-time scan of a freshly cloned repo, file watchers, ...) returns EPERM. This plugin now retries staging cleanup and target replacement internally (`maxRetries: 5`), so transient locks are skipped automatically; if it keeps recurring the lock is persistent — add `~/.dsh` to Windows Security exclusions, or restart once and retry (a leftover staging directory can be deleted by hand; it holds no data).
- **Startup error `[better-deepseek-harness] invalid config on the ext-center row ...`**: the `config:` block of the `ext-center` row in `cordis.patch.yml` has an illegal value (out of range or wrong type). Fix it per the "Deployment Configuration" section, or simply delete the `config:` block (everything falls back to defaults) and restart.
- **Occasional `invalid arguments: missing required property ...`**: the model occasionally generates tool arguments with missing fields or broken JSON. This plugin's `tools/execute` wrapper automatically repairs a missing `description` and recoverable JSON; calls genuinely missing `code` / `command` content still error out through DSH's native mechanism and make the model retry — that is normal feedback.
