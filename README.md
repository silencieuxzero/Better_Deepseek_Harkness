# better-deepseek-harness（更好的 DeepSeek Harness）

> 项目名致敬 Minecraft 模组名（？），更好的下界/末地/进度/砧板/FPS/地牢/村庄/经验修补/F3/树叶/动物动作/PVP/HUD/生存/战斗/延迟显示/附魔/图腾/掉落物/钠视频设置按钮……

为 DeepSeek Harness Web UI 编写的插件：在「设置 → 更好的 DeepSeek Harness」中直接安装、卸载、启用/停用 **技能（Skills）** 与 **插件（Plugins）**，并把插件的自身偏好接入原生设置体系（settings.yaml 的 `ext-center` 节）。

## 目录

- [功能](#功能)
- [安装](#安装)
- [部署配置](#部署配置ext-center-行的-config-块)
- [使用](#使用)
- [HTTP API](#http-api主机侧前缀-extapi)
- [故障排查](#故障排查)

> 想了解内部实现、参与开发与贡献？见 [CONTRIBUTING.md](CONTRIBUTING.md)（架构、目录结构、开发与测试流程）。

## 功能

<details>
<summary>点击展开功能列表</summary>

### 插件与技能管理

**技能管理**

- 列出已安装技能（名称 / 描述 / 适用场景 / 路径）
- 三种安装来源：
  - 粘贴 Markdown（含 `---` frontmatter，必须有 `name` 与 `description`）
  - 从 URL 下载 Markdown 文件
  - 本机文件或目录路径（目录需含 `SKILL.md`）
- 安装位置：`~/.dsh/skills`（技能文件系统提供方实时发现，无需重启）

**插件管理**

- 列出通过本插件安装的插件（版本 / 来源 / 配置行数 / 启用状态）
- 四种来源：npm 包名（走 npm registry）、`.tgz` 包 URL（内置 tar 解包，无需外部工具）、本机目录、Git 仓库
- Git 源若未提交构建产物（`lib/` 不存在），安装时自动 `npm install` + `npm run build` 补构建（需要本机有 npm；失败会给出明确报错，改用 npm / tarball 源即可）
- 安装后写入 profile 的 `cordis.patch.yml`，由启动时的 HMR 配置监听器**热生效，无需重启**；带客户端界面的插件在刷新页面后出现
- 启用 / 停用 / 卸载（同样热生效）
- 只读展示当前加载器条目（id / 状态 / 是否启用）

### 设置与偏好（设置页）

**原生设置项**（settings.yaml 的 `ext-center` 节）

| 设置项 | 说明 |
| --- | --- |
| `allowLan` | 是否允许局域网通过 `/ext/api` 访问（读写都包含：变更类接口以及文件树/终端输出/Git 读取/MCP 列表等回环端点；默认仅本机回环） |
| `skillRoot` | 技能安装根目录（留空 = `~/.dsh/skills`） |
| `customSkillDirs` | 额外技能目录，每行一个；其中的技能通过本插件注册的 provider 提供给所有会话 |
| `treeRoot` | 侧栏文件树根目录（留空 = 最近注册的工作区，其次进程工作目录） |

**MCP 服务器**：设置页「MCP」页签

- 添加自定义 MCP 服务器（stdio 本地命令 / streamable-http 远程 URL，支持参数、环境变量、工作目录、请求头、调用超时）
- 每个服务器写为 `cordis.patch.yml` 中的一行 `@deepseek-ai/dsh-mcp-client` 条目（id `ext-center.mcp.<名称>`），由配置监听器**热生效**
- 列表实时显示加载器状态（运行中 / 失败 / 已停用），支持启用 / 停用 / 移除
- 服务器工具以 `mcp__<名称>__<工具名>` 提供给模型；手写的外部 MCP 行只读展示

**图片转述**：设置页「图片转述」配置

- 启用后，含图片的模型请求在进入文本模型前，先由用户指定的视觉模型（提供方 / 模型 / 提示词 / 单次上限 1-8，部署上限可配置）通过 `llm/stream` 瀑布包装转述成文字——仅替换本次请求中的图片块，会话记录原图不受影响；转述失败自动降级为占位文本
- 提供方下拉来自已注册的 LLM 路由（`/ext/api/state` 的 `llmProviders`），也可选择「自定义路由」并填写 OpenAI 兼容的 `chat/completions` API URL
- 自定义路由支持配置 **API Key**（设置页密码输入框，仅写入不回显，留空保存保持原值）；转述请求携带 `Authorization: Bearer <key>` 头，`/ext/api/state` 只返回 `apiKeyConfigured` 布尔、不回传密钥本身
- 「转述输出上限（tokens）」可在设置页调整（64-8192，留空使用部署默认 `vision.maxTokens`，推理模型可适当调大）
- **启用开关会解除宿主 api-gateway 的图片准入限制**：宿主按当前模型的 `inputModalities` 拒绝不支持图片的模型（报 `MODEL_DOES_NOT_SUPPORT_IMAGES`）；开关开启时插件把当前模型宣告为支持图片输入（包装 `llm.resolveModelInfo`，仅追加 `image` 模态）；关闭时不做任何改动，保持宿主原生校验行为

**Tavily 搜索**：设置页「Tavily」页签（`ext-center.tavily`）

- 配置项：
  - **API Key**：必填，密码框支持显示 / 隐藏切换，仅写入不回显，留空保存保持原值；保存时校验格式（以 `tvly-` 开头且至少 20 个字符）
  - **搜索深度**：basic / advanced
  - **最大结果数**：1-10，默认 5
  - **包含原始内容**：开关，开启后每个来源附带原始网页内容（截断到 4000 字符）
  - **启用搜索**：总开关
- 支持一键保存与「重置 · Tavily」恢复默认
- 集成：启用后向模型注册 `tavily_search` 工具并在系统提示中加入引导——模型需要实时信息（新闻、价格、最新事件）或无法自信回答时自动调用，结果（摘要 + 来源列表 + 原始内容）注入上下文供参考并按要求引用来源
- 优雅降级：总开关关闭、API Key 缺失或调用失败时返回明确错误提示（由 agent loop 转为工具错误结果），模型凭已有知识作答，**不阻塞正常回答**；开关变更实时生效（settings `watch` 联动注册 / 注销工具与提示引导，无需重启）

### 会话与侧栏

**侧栏文件树**：侧栏底部「文件树」按钮

- 工作区文件浏览（`GET /ext/api/tree`），逐级展开目录：目录显示子项数、文件显示大小，每行可一键复制路径；支持全部收起
- 根目录配置：设置项 `treeRoot`（留空 = 最近注册的工作区，其次进程工作目录）
- 点击文件在弹窗编辑器中打开，可保存（仅限树根内既有文件，1 MiB 上限，二进制 / NUL 防护）；点击面板外部或按 Esc 自动收起

**归档对话管理**：侧栏底部「归档」按钮

- 列出当前已归档的所有会话（标题 / 工作区 / 更新时间）；勾选后批量**永久删除**（删除前二次确认；仍在运行 / 加载中的会话自动跳过并提示）
- 删除由宿主侧 `/ext/api/archive/delete` 完成：移除对应 JSONL 会话日志并清理工作区记账

**多终端**：对话页「终端」页签（`conversation.view` slot）

- 自主创建 **CMD** 或 **PowerShell** 终端并多开（上限可配置，默认 8 个）
- 左侧为活动终端（输出区 + 命令输入行 + 中断按钮），右侧列出全部终端（切换 / 关闭）
- 默认在工作区（文件树根）启动；输出通过轮询增量拉取，ANSI 转义序列在进入输出缓冲区前剥离（颜色 / 光标 / 窗口标题不会变成乱码）
- 基于 node-pty（缺失时回退普通管道），插件卸载时自动清理全部终端进程

**Git 面板**：对话页「Git」页签（`conversation.view` slot，`ext-center.git`），VSCode「源代码管理」风格

- 顶部工具条：分支下拉切换、上游 / 领先 / 落后徽章、拉取（--ff-only）/ 推送 / 刷新
- 提交区：多行提交信息（Ctrl+Enter 提交）；按钮显示已暂存数量；无暂存或有合并冲突时禁用并提示
- 更改分组：已暂存的更改 / 未暂存的更改 / 未跟踪的文件，含 VSCode 配色状态徽章（M/A/D/R/冲突/未跟踪）、重命名来源、行内「+ / − / ✕」（暂存 / 取消暂存 / 放弃更改，放弃需确认）；组头「全部暂存 / 全部取消暂存」
- 差异视图：点击文件查看统一 diff（行号 + 增删 / 上下文 / 块头着色）；未跟踪文件以全新增形式展示；二进制文件与超大差异有提示；合并冲突以合并 diff 原样展示
- 提交历史：最近提交（条数可配置，默认 30；短哈希 / 作者 / 时间 / 主题）
- 状态自动刷新（间隔可配置，默认 5 秒）；仓库自动从文件树根向上查找 `.git`；所有操作由主机侧 git 子进程执行（`GIT_TERMINAL_PROMPT=0`，防挂起）

**优化输入**：会话输入框右下角（发送按钮与上下文按钮之间）「优化输入」按钮（星星图标）

- 点击后用当前会话所选模型对输入进行优化，结果直接回填到输入框，便于发送前润色 prompt

### 稳健性

**工具参数自动修复**

- 通过 `tools/execute` 包装层修复模型偶发的参数抖动：
  - `description` 缺失 / 为空 / 类型错误时自动补上中性占位符
  - `arguments` 是损坏 JSON（截断、夹杂文字、尾逗号）时尝试恢复为对象
- 避免无谓的 `INVALID_ARGS` 报错，让对话更流畅

</details>

## 安装

### 方式一：Git 安装（推荐，需要 git，无需 pnpm / npm）

克隆本仓库，然后运行仓库内的一键安装脚本：

```powershell
git clone https://github.com/silencieuxzero/Better_Deepseek_Harkness.git
cd Better_Deepseek_Harkness
.\install.ps1                # 默认装入 web profile；其它 profile：.\install.ps1 -Profile agents
```

脚本会把本包复制到共享模块根 `~/.dsh/profiles/node_modules/better-deepseek-harness`，并在 profile 的 `cordis.patch.yml` 追加 `ext-center` 行（按 id 去重）。配置监听器会在几秒内热生效：主机侧 API 立即可用，浏览器刷新页面后「设置 → 更好的 DeepSeek Harness」出现。

### 方式二：手动安装（无需 git / pnpm / npm）

把 `better-deepseek-harness` 整个目录复制到共享模块根（git clone 下来的目录名是 `Better_Deepseek_Harkness`，按实际目录名复制即可）：

```powershell
Copy-Item -Recurse Better_Deepseek_Harkness "$HOME\.dsh\profiles\node_modules\better-deepseek-harness"
```

然后在 profile 的 `cordis.patch.yml`（例如 `~/.dsh/profiles/web/cordis.patch.yml`）追加：

```yaml
- insert:
    - id: ext-center
      name: better-deepseek-harness
```

配置监听器会在几秒内热生效：主机侧 API 立即可用，浏览器刷新页面后「设置 → 更好的 DeepSeek Harness」出现。

### 方式三：官方 `dsh plugin` 流程（需要 pnpm）

本地目录（或方式一 clone 下来的目录）：

```bash
dsh plugin --profile web add file:/path/to/better-deepseek-harness
```

也可以直接从 Git 仓库安装（需要 git）：

```bash
dsh plugin --profile web add git+https://github.com/silencieuxzero/Better_Deepseek_Harkness.git
```

本包在 package.json 的 `dsh.bundle.patch` 中声明的补丁文件（`cordis.patch.yml`）会插入同名（`ext-center`）行，与方式一、方式二按 id 去重、不冲突。

## 部署配置（ext-center 行的 config 块）

部署可调的行为全部收敛在 `cordis.patch.yml` 中 `ext-center` 行的 `config:` 块，用 schemastery 校验：每个字段自带默认值与合法范围，非法值会让插件**加载失败并给出明确报错**（宁可响亮失败，不静默漂移）。安全不变量（请求体 2 MiB、文件编辑器 1 MiB、终端单次写入 4096 字符、git 单批路径 500 条、归档删除单批 500 条、输入优化单次文本 100 KiB）保持固定、不可配置。

```yaml
- insert:
    - id: ext-center
      name: better-deepseek-harness
      config:
        pluginRoot: ""                  # 插件安装根；留空 = profile 共享模块根 node_modules
        tree:
          maxEntries: 2000             # 单目录最多返回条目数
          ignores: [".git", ".svn", ".hg", "node_modules", ".dsh", "dist",
                    ".next", ".cache", ".turbo", "coverage", "__pycache__",
                    ".DS_Store"]
        terminal:
          maxSessions: 8               # 终端并发上限（1-64）
          bufferLimit: 262144          # 每个终端的输出环形缓冲（字节）
        git:
          timeoutMs: 60000             # 单条 git 命令超时（毫秒）
          diffLimit: 524288            # 单文件 diff 载荷上限（字节，超出截断）
          logMax: 30                   # 提交历史条数
        mcp:
          maxServers: 16               # 面板管理的 MCP 服务器上限
        vision:
          maxImagesCap: 8              # 单次请求转述图片的部署上限（设置页的 1-N 以此为界）
          maxTokens: 1024              # 单次转述输出的默认 token 上限（设置页可覆盖，64-8192）
        toolRepair:
          enabled: true                # tools/execute 参数修复总开关
          descriptionFill: "Execute tool"   # description 缺失时的中性占位文案
        client:
          terminalPollMs: 300          # 浏览器终端输出轮询间隔
          terminalListPollMs: 2000     # 浏览器终端列表轮询间隔
          gitPollMs: 5000              # 浏览器 git 状态轮询间隔
          mcpPollMs: 3000              # 浏览器 MCP 列表轮询间隔
```

以上全部字段均可省略（省略即取默认值）；`config:` 块本身也可省略。改完后配置监听器热生效（config 属于 ext-center 行的元数据，同样由监听器重放）。Web UI 通过 `/ext/api/state` 的 `limits` 块读取这些上限，界面文案（「前 2000 项」「上限 8 个」等）与轮询节奏随之自动跟随。

## 使用

1. 打开 Web UI → 设置（齿轮）→ **更好的 DeepSeek Harness**
2. 「技能」页：填写名称（小写 kebab-case）与内容 / URL / 路径，点安装；列表项可卸载
3. 「插件」页：选择来源并填写 npm 包名 / tarball URL / 本机目录 / Git 仓库地址，点安装；已安装插件可启用、停用、卸载
4. 「设置」页：修改本插件的偏好（保存到 settings.yaml 的 `ext-center` 节）
5. 「Tavily」页：填写 API Key 并打开「启用搜索」，会话中模型需要实时信息时会自动搜索并引用来源
6. 会话页：在输入框右下角（发送按钮与上下文按钮之间）点击星星图标「优化输入」，当前模型会把输入优化后回填到输入框
7. 侧栏底部：点击「归档」查看已归档对话，勾选后点击「删除」批量永久删除（需二次确认；仍在运行 / 加载中的会话会自动跳过并提示）

> 安全：所有变更类接口以及会暴露本机路径/输出的读取端点（`/ext/api/state`、文件树、终端输出、Git 读取、MCP 列表）默认只允许本机（回环地址）调用；如需局域网管理，在「设置」页打开 `allowLan`。另外注意：Git 源安装本身等于运行仓库里的代码——安装/加载插件以及自动构建（`npm install` 会执行该仓库声明的 npm 生命周期脚本）都会执行其内容，请只安装你信任的仓库。

## HTTP API（主机侧，前缀 /ext/api）

> 响应统一为 `{ok: true, value}` 或 `{ok: false, error: {code, message}}`。

### 状态与配置

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/state` | 全量状态：技能列表、插件安装记录、加载器条目、配置，以及 `limits`（各上限与客户端轮询间隔，见「部署配置」） |
| `POST /ext/api/config` | 写 `ext-center` 设置命名空间（`allowLan` / `skillRoot` / `customSkillDirs` / `treeRoot` / `vision` / `tavily`） |

### 文件树

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/tree?path=...` | 列出根目录下的一级条目（type / size / mtime / children 计数、`truncated` 截断标记与 `maxEntries` 上限）；根目录解析：`treeRoot` 设置 → 最近注册的工作区 → 进程工作目录 |
| `GET /ext/api/tree/content?path=...` | 读取树根内一个文本文件（拒绝目录 / 超大 / 含 NUL 的二进制），供编辑器打开 |
| `POST /ext/api/tree/write` | `{path, content}` 原子写回树根内既有文件（临时文件 + rename；同样有大小与二进制防护） |

### 终端

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/terminal/list` | 全部终端会话（id / kind / cwd / alive / exitCode / createdAt） |
| `POST /ext/api/terminal/create` | `{kind: 'cmd'\|'powershell'}` 新建终端（上限 = `terminal.maxSessions`，默认 8；cwd = 文件树根），返回 `{id, kind, cwd}` |
| `POST /ext/api/terminal/write` | `{id, data}` 写入输入（单次 ≤ 4096 字符；已退出终端拒绝） |
| `POST /ext/api/terminal/resize` | `{id, cols, rows}` 调整终端尺寸（pty 模式生效） |
| `POST /ext/api/terminal/kill` | `{id}` 关闭终端（幂等） |
| `GET /ext/api/terminal/output?id=..&after=..` | 轮询增量输出：`after` 为客户端已读字节 offset，返回 `{alive, exitCode, text, cursor}`；`cursor` 是流的权威 offset（环形缓冲区截断后客户端以它重置，而不是自增） |

### Git

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/git/status` | 仓库根、分支、上游、领先/落后、更改列表（含 staged / unstaged / untracked / 重命名 / 冲突标记） |
| `GET /ext/api/git/diff?path=..&staged=0\|1` | 单文件 diff（结构化为 meta/hunk/ctx/add/del 行，带双侧行号；未跟踪文件按全新增合成；合并冲突按 combined 原样返回） |
| `GET /ext/api/git/log?n=30` | 最近提交（oid / short / author / time / subject） |
| `GET /ext/api/git/branches` | 分支列表（含 current 标记） |
| `POST /ext/api/git/stage` | `{paths:[...]}` 暂存（git add） |
| `POST /ext/api/git/stage-all` | 全部暂存（git add -A） |
| `POST /ext/api/git/unstage` | `{paths:[...]}` 取消暂存（git restore --staged） |
| `POST /ext/api/git/unstage-all` | 全部取消暂存（git reset） |
| `POST /ext/api/git/commit` | `{message}` 提交（git commit -m） |
| `POST /ext/api/git/discard` | `{paths:[...]}` 放弃更改（git checkout --；未跟踪文件直接删除，拒绝目录） |
| `POST /ext/api/git/checkout` | `{branch}` 切换分支（名称白名单校验） |
| `POST /ext/api/git/pull` | 拉取（--ff-only，超时 = `git.timeoutMs`，默认 60 秒） |
| `POST /ext/api/git/push` | 推送（超时 = `git.timeoutMs`，默认 60 秒） |

### MCP

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/mcp/list` | 服务器列表（面板管理的行 + 外部手写行，含配置摘要与加载器状态）与 `max`（部署上限） |
| `POST /ext/api/mcp/add` | `{name, transport, command?, args?, env?, cwd?, url?, headers?, toolCallTimeoutMs?}` 添加服务器（写入 patch 行并热生效） |
| `POST /ext/api/mcp/remove` | `{name}` 移除服务器（删除 patch 行并热生效） |
| `POST /ext/api/mcp/set-enabled` | `{name, enabled}` 启用 / 停用（patch 行 disabled 标记） |

### 技能与插件

| 端点 | 说明 |
| --- | --- |
| `POST /ext/api/skill/install` | `{name, text?\|url?\|path?}` 安装技能 |
| `POST /ext/api/skill/uninstall` | `{name}` 卸载技能 |
| `POST /ext/api/plugin/install` | `{source: {kind: 'npm'\|'url'\|'folder'\|'git', spec?\|url?\|path?}}` 安装插件 |
| `POST /ext/api/plugin/uninstall` | `{name}` 卸载插件（移除补丁行 + 包目录） |
| `POST /ext/api/plugin/set-enabled` | `{name, enabled}` 启用 / 停用插件 |

### 对话与归档

| 端点 | 说明 |
| --- | --- |
| `POST /ext/api/input/optimize` | `{text, provider, model, sessionId?, reasoningEffort?}` 用指定（当前会话所选）模型优化输入，返回 `{text}` |
| `POST /ext/api/archive/delete` | `{ids:[...]}` 批量永久删除已归档会话（必须位于归档集合；仍在运行 / 加载中的会话跳过），返回 `{deleted, skipped, count}` |

## 故障排查

- **改动未热生效**：`cordis.patch.yml` 的变更由 harness 的配置监听器（HMR）应用。若短时间内连续多次修改（例如安装后立刻停用）触发监听器竞态，配置监听可能卡住——重启一次 `dsh web` 即可恢复（补丁文件本身是正确的，重启后照常加载）。本插件的写入已做间隔串行化以尽量避免该情况。
- **看不到设置页区块**：浏览器刷新页面（客户端 bundle 由 boot manifest 注入，刷新后加载）。
- **设置页一直「加载中…」/ 图片转述没有配置项**：设置页改走本插件自己的 `/ext/api/state` 与 `/ext/api/config`，不再依赖 api-proxy 是否暴露 `ext-center`。旧版本若仍在加载中，升级后重启 `dsh web` 并刷新页面；若只有旧版可用，检查宿主日志确认 `ext-center` 设置命名空间已注册。
- **安装报 git-unavailable**：本机未安装 git，改用目录 / tarball URL / npm 包名来源。
- **安装报 build-failed / build-tool-missing**：Git 源仓库没有提交构建产物，且自动构建失败（或本机没有 npm）。先确认本机 `npm` 可用且能访问 registry；若仓库没有 `build` 脚本或构建后仍缺入口文件，请改用该包的 npm 包名 / tarball URL 安装。
- **安装报 `EPERM: Permission denied`（Windows，路径指向 `.dsh-ext-center-staging`）**：Windows 上删除目录时若被其他进程短暂占用（杀毒实时扫描刚 clone 的仓库、文件监听等），会返回 EPERM。本插件已在 staging 清理与目标目录替换处内置重试（`maxRetries: 5`），瞬时锁会自动跳过；若反复复现说明锁是持续性的——将 `~/.dsh` 加入 Windows 安全中心的排除目录，或重启一次后再装（残留的 staging 目录可手动删除，不影响数据）。
- **启动报 `[better-deepseek-harness] invalid config on the ext-center row ...`**：`cordis.patch.yml` 里 `ext-center` 行的 `config:` 有非法值（超出范围或类型错误）。按「部署配置」一节修正或直接删掉该 `config:` 块（全部回落默认值）后重启。
- **偶发 `invalid arguments: missing required property ...`**：模型生成的工具参数偶发缺字段或 JSON 损坏。本插件的 `tools/execute` 包装层会自动修复 `description` 缺失与可恢复的 JSON；确实缺少 `code` / `command` 等内容的调用仍会按 DSH 原机制报错并让模型重试，属正常反馈。
