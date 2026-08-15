# 更新日志（Changelog）

本文件记录 **better-deepseek-harness** 的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。英文版见 [CHANGELOG.md](CHANGELOG.md)。

## [Unreleased]

### 新增

- **dsh-TUI / 无头宿主适配**：对 [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) 类终端宿主（组合里没有 `webServer` 服务）完整支持，所有不依赖 GUI 的功能原样工作：
  - `webServer` 改为可选注入（静态注入只保留 `tools`）：无 web 层的宿主里插件照常加载，急救看门狗、设置命名空间、技能目录、Tavily 工具、工具参数修复、图片转述全部继续工作，仅 `/ext/api` 路由不挂载；
  - **`/rescue` 斜杠命令**：宿主挂载 dsh-commands 注册表时自动注册（dsh-TUI 会把注册表命令并入其斜杠菜单）——`/rescue`（状态）、`/rescue apply all|none|<插件名,...>`（恢复选择）、`/rescue trigger`（手动进入急救），恢复逻辑与 Web 对话框走同一套纯函数；
  - **前门 bundle 自动保护**：无 `webServer` 的宿主里，第三方 bundle 若把自己挂载为加载器行（insert 行 `name` 等于自身包名），急救模式判定它就是宿主界面本身，**永不禁用**（否则急救会禁用掉 TUI 自身、且终端里没有恢复对话框，宿主将无法恢复）；显式兜底配置 `rescue.protectBundles` 可追加保护名单；
  - 配置：`ext-center` 行 `rescue.protectBundles`（字符串数组，默认空）。`src/rescue.ts` 的 `buildRescuePlan` 新增保护参数，由 `tests/rescue.spec.ts` 与 `tests/host-wiring.spec.ts` 新用例覆盖。
- **急救模式（rescue mode）**：DeepSeek Harness 启动失败（插件冲突、第三方插件未构建导致加载失败、重复的加载器条目 id，或上次启动在启动窗口内崩溃退出）时自动进入急救模式：
  - 除本插件外的所有第三方插件默认全部禁用（patch 行原地加 `disabled: true`；第三方 profile bundle 按其自身补丁行 id 追加禁用行），经 `cordis.patch.yml` 热生效，以最小化配置继续运行——无需手动改文件；
  - 启动成功后弹出对话框，列出每个被禁用插件的名称与禁用原因（fiber 失败时尽力附上加载器自己的报错），可多选重新启用，并提供「全部恢复」「保持禁用」「启用所选并重新加载」快捷选项；
  - 用户确认后经同一事务性补丁写入器按选择写回配置并重新加载（桌面宿主刷新页面；命令行宿主重启进程）；
  - 本插件自身功能完全不受影响（自身行与 harness 核心行永不被禁用，设置/终端/git/MCP/视觉/Tavily/文件树照常工作）；
  - 「插件」页新增「进入急救模式」按钮，可手动触发同一流程。
  - 配置：`ext-center` 行 `rescue.enabled`（默认 true）与 `rescue.settleMs`（启动窗口，默认 12000）；侧车状态在 profile 目录的 `.dsh-rescue.json`。纯逻辑在 `src/rescue.ts`（状态机、启动问题检测、禁用/恢复计划），由 `tests/rescue.spec.ts` 与新增的 `tests/host-wiring.spec.ts` 用例覆盖。
- **dsh-web-ui 兼容补丁**：同一 profile 里 dsh-web-ui 全家桶（https://github.com/zhu1090093659/dsh-web-ui）已安装且 ACTIVE 时，本插件对全家桶拥有的界面元素主动让位，不再加载自身对应功能：
  - `@linxin666/dsh-client-ui-aionui-panel`（右侧文件树 / SCM 面板）或 `@linxin666/dsh-client-ui-git-graph` 生效时，侧栏文件树与对话页「Git」页签不注册；
  - `@linxin666/dsh-ssh` 生效时，对话页「终端」页签不注册；
  - `@linxin666/dsh-tool-describe-image` 生效时，宿主侧图片转述与视觉能力桥保持惰性（该场景下图像理解由 describe-image 负责）；
  - 检测按加载器条目 id 或包名匹配，且只统计 ACTIVE 且未禁用的 fiber——全家桶插件处于 pending / 失败时本插件保留自己的界面；宿主侧在加载器树收敛后会复查一次。纯逻辑在 `src/compat.ts`（家族注册表、检测、抑制映射），`src/client.js` 内联同表，由 `tests/compat.spec.ts`、`tests/compat-client.spec.ts` 与新增的 `tests/host-wiring.spec.ts` 用例覆盖。

### 修复

- **Git 源安装自动补构建**：仓库未提交构建产物（`lib/` 完全不存在，即源码未构建）时，安装不再得到残缺包——克隆后检查包声明入口（`main` / `exports`），缺失则自动 `npm install` + `npm run build` 补构建（单步超时 10 分钟，失败给出明确报错并附输出尾部；本机无 npm 时报 `build-tool-missing`）。安装成功消息会标注「已自动执行 npm install 并构建」。
- **Tavily 开关可反复启停**：把 Tavily 总开关关闭后再打开，现在会重新注册 `tavily_search` 工具与提示引导（此前首次关闭后同步状态被永久停用，无法再启用）。
- **MCP 表单校验不再卡死界面**：超时 / 环境变量 / 请求头校验失败时只显示错误，不再让全部控件保持禁用。
- **`install.ps1` 追加行保持独立**：当 profile 的 `cordis.patch.yml` 不以换行结尾时，安装脚本会先补一个换行再追加 `ext-center` 行，避免与最后一行 YAML 粘连。
- **同步英文 README**：补齐急救模式相关功能说明、部署配置、使用步骤、HTTP API 与故障排查。

## [0.6.0] - 2026-08-15

### 新增

- **Tavily 搜索集成**，带独立设置页签（`ext-center.tavily`）：
  - API Key（密码框支持显示 / 隐藏切换，仅写入不回显，保存时校验格式：`tvly-` 开头且至少 20 个字符）；
  - 搜索深度（`basic` / `advanced`）、最大结果数（1–10，默认 5）、包含原始内容开关（原始网页内容截断到 4000 字符）、总开关；
  - 启用后向模型注册 `tavily_search` 工具并在系统提示中加入引导：模型需要实时信息（新闻、价格、最新事件）或无法自信回答时自动调用；结果（摘要 + 来源列表 + 原始内容）注入上下文供参考并按要求引用来源；
  - 优雅降级：总开关关闭、API Key 缺失或调用失败时返回明确错误提示（由 agent loop 转为工具错误结果），模型凭已有知识作答，**不阻塞正常回答**；开关变更经 settings `watch` 实时生效（无需重启）。
- **自定义视觉转述端点**（`2c58c47`）：除从已注册 LLM 路由中选择提供方外，可选手「自定义路由」并填写 OpenAI 兼容的 `chat/completions` API URL。
  - **视觉 API Key 支持**（`9445b22`）：设置页密码输入框，仅写入不回显；转述请求携带 `Authorization: Bearer <key>` 头；`/ext/api/state` 只返回 `apiKeyConfigured` 布尔、不回传密钥本身。
  - **`vision.maxTokens` 用户覆盖**（`96192c1`）：设置页可调（64–8192，留空使用部署默认 `vision.maxTokens`）。
- **api-gateway 图片准入桥**（`b44cf52`）：转述开关开启时，插件包装 `llm.resolveModelInfo` 为当前模型追加 `image` 模态，使带图请求进入转述瀑布而非被 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拒绝；关闭开关即恢复宿主原生校验，不做任何改动。
- **归档对话管理**（`11f4c49`）：侧栏底部「归档」按钮列出已归档会话（标题 / 工作区 / 更新时间）；勾选后批量**永久删除**（删除前二次确认；仍在运行 / 加载中的会话自动跳过并提示）；删除由宿主侧 `/ext/api/archive/delete` 完成，移除对应 JSONL 会话日志并清理工作区记账。
- **终端环形缓冲**（`3648665`）：每个终端的输出存入有界字节环（`terminal-buffer.ts`），以截断安全的绝对字节 offset 增量拉取；ANSI 转义序列在进入缓冲前剥离（`44071de`），颜色 / 光标 / 窗口标题不会变成乱码。

### 变更

- 仓库重构为 Harness 包约定（`82623aa`）：`src/` 源码、`tests/` vitest 规格、`docs/` 架构与开发文档、`lib/` 构建产物提交进 git；`npm run typecheck / test / build / check`。
- 设置页中 ext-center 设置区块移至 AGENT 预设正下方（`6324e3a`）。
- 设置改由本插件自己的 `/ext/api/state` + `/ext/api/config` 读写（`5e3d086`、`da3c394`）；`ext-center` 设置命名空间仅在 settings 服务就绪后注册（`ctx.inject(["settings"])`），插件先于 settings 启动也不丢命名空间。
- Git 页签作用域限定为当前会话工作区（`42b5675`）。
- README 功能列表改为可折叠（`13a6daf`），随后整体重构 README 布局（`cac6773`）。

### 修复

- 修复插件安装路径并加固路由处理（`4544298`）。
- `llm/stream` 视觉包装器改为返回异步可迭代对象，符合瀑布契约（`da3c394`）。
- 自定义视觉转述在模型未返回 content 时回退读取 `reasoning` 字段（`7a104dd`）；转述端点错误详情透出到回退文本（`0c19301`）。
- 图片转述卡片补齐保存 / 重置操作（`d2629d7`）。
- 「优化输入」在模型回复为空时不再返回空结果（`11f4c49`）。
- 归档侧栏布局打磨：归档与文件树操作纵向堆叠，归档置于文件树上方（`ea61c94`、`2e13d0b`、`fd7fd79`）。
- 自查加固：可选服务查找加防护、helper 去重、清理陈旧命名、同步文档（`a86f84e`、`3648665`）。

## [0.5.0] - 2026-08-14

### 新增

- **可配置图片转述**（`8a5d0e2`）：启用后，含图片的模型请求在进入文本模型前，先由用户指定的视觉模型（提供方 / 模型 / 提示词 / 单次上限 1–8，部署上限可配置）经 `llm/stream` 瀑布转述成文字——仅替换本次请求中的图片块，会话记录原图不受影响；转述失败自动降级为占位文本。
- 提供方下拉来自已注册的 LLM 路由（`/ext/api/state` 的 `llmProviders`）。

## [0.4.0] - 2026-08-14

### 新增

- **MCP 页签**（`8afd228`）：用户自定义 MCP 服务器以活的 `dsh-mcp-client` 行呈现。
  - 支持 `stdio`（本地命令）与 `streamable-http`（远程 URL）两种传输，可配置参数、环境变量、工作目录、请求头与调用超时；
  - 每个服务器写为 `cordis.patch.yml` 中一行 `@deepseek-ai/dsh-mcp-client`（id `ext-center.mcp.<名称>`），由配置监听器**热生效**；
  - 列表实时显示加载器状态（运行中 / 失败 / 已停用），支持启用 / 停用 / 移除；
  - 服务器工具以 `mcp__<名称>__<工具名>` 提供给模型；手写的外部 MCP 行只读展示。

## [0.3.0] - 2026-08-14

### 新增

- **Git 面板页签**（`d2eebe7`）：对话页 VSCode「源代码管理」风格（`conversation.view` slot，`ext-center.git`）。
  - 顶部工具条：分支下拉切换、上游 / 领先 / 落后徽章、拉取（`--ff-only`）/ 推送 / 刷新；
  - 提交区：多行提交信息（Ctrl+Enter 提交）、显示已暂存数量；无暂存或有合并冲突时禁用并提示；
  - 更改分组：已暂存 / 未暂存 / 未跟踪文件，含 VSCode 配色状态徽章（M/A/D/R/冲突/未跟踪）、重命名来源、行内「+ / − / ✕」（暂存 / 取消暂存 / 放弃更改，放弃需确认）、组头「全部暂存 / 全部取消暂存」；
  - 差异视图：统一 diff，带行号与增删 / 上下文 / 块头着色；未跟踪文件以全新增形式展示；二进制文件与超大差异有提示；合并冲突以合并 diff 原样展示；
  - 提交历史：最近提交（条数可配置，默认 30；短哈希 / 作者 / 时间 / 主题）；
  - 状态自动刷新（间隔可配置，默认 5 秒）；仓库自动从文件树根向上查找 `.git`；所有操作由主机侧 git 子进程执行（`GIT_TERMINAL_PROMPT=0`，防挂起）。

## [0.2.0] - 2026-08-14

### 新增

- **模型工具参数自动修复**（`5145e5e`）：通过 `tools/execute` 包装层修复偶发 `INVALID_ARGS`——`description` 缺失 / 为空 / 类型错误时自动补中性占位符，损坏 JSON（截断、夹杂文字、尾逗号）恢复为对象；只修安全字段，绝不伪造 `code` / `command` 等内容字段；`toolRepair.enabled` 可整体关闭、`descriptionFill` 可换占位文案。
- **多终端页签**（`5f15400`）：并排创建 **CMD** / **PowerShell** 终端（node-pty，缺失时回退普通管道；并发上限可配置，默认 8）。
  - 左侧活动终端（输出区 + 命令输入行 + 中断按钮），右侧终端列表（切换 / 关闭）；
  - 输出通过轮询增量拉取，ANSI 转义序列在进入输出缓冲区前剥离；
  - VS Code 风格主题感知渲染（`fdfcfdf`）；终端退出后写入有防护——pty 写入不再暴露原始 TypeError（`c73fb6e`，`term-write` 错误码）；插件卸载时清理全部终端进程；
  - 终端页签移至对话页 Trajectory 旁（`conversation.view` slot）（`8a6645a`）。
- **侧栏文件树打磨**：
  - `treeRoot` 设置；目录显示子项数、文件显示大小、一键复制路径、全部收起、截断防护（`4fdfd5b`）；
  - 默认展示最近注册的工作区，其次进程工作目录（`3125e7a`）；
  - 点击面板外部或按 Esc 自动收起（`bb7f853`）；
  - 点击文件打开编辑弹窗并可保存——`GET /ext/api/tree/content` + `POST /ext/api/tree/write` 端点（`74d97b4`），编辑器放大为 16:9 区域（`min(1024px, 94vw)`）（`da78517`）。
- 仓库自查（`0e481b8`）：版本号从 `package.json` 派生、修正陈旧 `dsh-extension-center` 命名、删除死代码、合并重复 CSS、修复 `install.ps1` 引号、补文档。

## [0.1.0] - 2026-08-14

### 新增

初始版本。

- **技能管理**（Web UI 设置页「设置 → 更好的 DeepSeek Harness」）：
  - 列出已安装技能（名称 / 描述 / 适用场景 / 路径）；
  - 三种安装来源：粘贴 Markdown（含 `---` frontmatter，必须有 `name` 与 `description`）、从 URL 下载 Markdown 文件、本机文件或目录路径（目录需含 `SKILL.md`）；
  - 安装位置：`~/.dsh/skills`（技能文件系统提供方实时发现，无需重启）。
- **插件管理**：
  - 列出通过本插件安装的插件（版本 / 来源 / 配置行数 / 启用状态）；
  - 四种来源：npm 包名（走 npm registry）、`.tgz` 包 URL（内置 tar 解包，无需外部工具）、本机目录、Git 仓库（`321fc9b`）；
  - 安装后写入 profile 的 `cordis.patch.yml`，由 HMR 配置监听器**热生效，无需重启**；带客户端界面的插件在刷新页面后出现；
  - 启用 / 停用 / 卸载（同样热生效），只读展示当前加载器条目（id / 状态 / 是否启用）。
- **设置项**（原生设置命名空间 `ext-center`）：`allowLan`（局域网访问 `/ext/api` 变更类接口，默认仅本机回环）、`skillRoot`（技能安装根目录）、`customSkillDirs`（额外技能目录，经注册的 provider 提供给所有会话）。
- **HTTP API**：`/ext/api` 前缀，统一 `{ok: true, value}` / `{ok: false, error: {code, message}}` 响应；静态路由表统一处理回环检查、2 MiB 请求体上限与错误映射。
- **一键安装**（`install.ps1`）与手动安装路径（`321fc9b`），以及经 `dsh.bundle.patch` 声明的官方 `dsh plugin` 流程。

[Unreleased]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.6.0
[0.5.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.5.0
[0.4.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.4.0
[0.3.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.3.0
[0.2.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.2.0
[0.1.0]: https://github.com/silencieuxzero/Better_Deepseek_Harkness/releases/tag/v0.1.0
