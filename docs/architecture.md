# better-deepseek-harness 架构

阅读本文后再改动本插件的任何代码。它假设你了解 Cordis 与 DeepSeek Harness 的基础概念；若不了解，先读 Harness 的 [架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) 与 [Cordis 入门](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)。

本插件遵循 Harness 的核心原则：**一切皆插件**。它没有特权核心，只是作为 `ext-center` 行挂载在 profile 的插件树里；所有注册都是可回退的效应（`ctx.effect`），插件卸载时一并释放。

## 两半结构

| 半 | 文件 | 运行环境 | 职责 |
| --- | --- | --- | --- |
| 宿主侧 | `src/index.js` | dsh 主机进程（Node） | 设置命名空间、/ext/api 路由、技能/插件生命周期、文件树、终端、git、MCP、图片转述、工具参数修复、急救模式看门狗与宿主副作用 |
| 客户端 | `src/client.js` | 浏览器（Web UI） | 设置页「更好的 DeepSeek Harness」区块、对话页「终端」「Git」页签、侧栏文件树、急救模式恢复对话框 |
| 纯逻辑 | `src/tool-args.ts`、`src/ansi.ts`、`src/tavily.ts`、`src/github.ts`、`src/notify.ts`、`src/terminal-buffer.ts`、`src/rescue.ts`、`src/compat.ts` | 宿主侧 | 模型工具参数的 JSON 恢复与 description 修补；终端 ANSI 转义序列的流式剥离；Tavily 设置/请求/响应纯函数；GitHub REST API 的设置/参数校验/URL 构建/响应映射/格式化纯函数；Windows 通知的设置/文案/Toast 脚本构建/agent 流程追踪纯函数；终端输出字节环与增量 offset 语义；急救模式状态机、启动问题检测、禁用/恢复计划；dsh-web-ui 家族注册表、存在性检测与界面让位映射 |

`package.json` 的 `dsh` 字段声明了这个插件如何进入运行时：

- `dsh.bundle.patch: "cordis.patch.yml"`：bundle 补丁，插入 `ext-center` 行；
- `dsh.client.inject`：客户端注入的运行时依赖（client-runtime、locale、ui-slots、ui-sidebar、ui-primitives）；
- `dsh.client.platform: "web"`：客户端目标平台。

## 扩展点（能力接缝）

新行为一律挂在文档化的扩展点上，绝不修改 agent-loop 本身。本插件用到的接缝：

| 目标 | 接缝 | 用途 |
| --- | --- | --- |
| 插件自身偏好 | `ctx.inject(["settings"], ...)` 内 `settings.register(SETTINGS_NS, SettingsSchema, { base: DEFAULTS })` | `ext-center` 设置命名空间，写入 settings.yaml；注入纤维等待 settings 服务就绪，插件先于 settings 启动也能注册成功 |
| HTTP API | `ctx.webServer.register({ kind: "prefix", path: "/ext/api", handler })` | 全部 /ext/api 端点 |
| 自定义技能目录 | `skills.registerProvider(...)` | 把 `customSkillDirs` 中的技能提供给所有会话 |
| 拦截工具调用 | `ctx.on("tools/execute", ...)` 瀑布 | 参数校验前修复 description 缺失与损坏 JSON（与 `dsh-tool-call-timeout-policy` 同机制） |
| 拦截模型请求 | `ctx.on("llm/stream", ...)` 瀑布 | 含图片的请求先由视觉模型转述成文字；监听器返回异步可迭代对象（async generator），与瀑布“最外层返回值必须是 async iterable”的约定一致 |
| 模型搜索工具 | `ctx.tools.register` + `ctx.inject(["systemPrompt"], ...)` 的 `systemPrompt.section` | `ext-center.tavily.enabled` 开启时注册 `tavily_search` 工具与提示引导（设置变更经 settings 命名空间 owner 的 `watch` 联动注册/注销）；执行时读实时设置，未启用/未配置/调用失败抛清晰错误，由 agent loop 转为工具错误结果——模型看到提示后凭已有知识作答，不阻塞正常回答 |
| GitHub 仓库工具 | `ctx.tools.register` + `ctx.inject(["systemPrompt"], ...)` 的 `systemPrompt.section` | `ext-center.github.enabled` 为真（默认开，公开仓库无需 token）时注册 `github_repo` / `github_tree` / `github_file` / `github_search` / `github_releases` 五个工具与提示引导；生命周期与 Tavily 相同（effect 释放、settings `watch` 联动、执行时实时读设置与 token，未启用/请求失败抛清晰错误，不阻塞正常回答） |
| Windows 通知 | `ctx.on("tools/execute")` + `ctx.on("agent/status")` + `ctx.on("agent/error")` | 仅 win32：模型调用 `ask_user_question` 时弹 Toast（问题摘要）；根 agent 一次流程 running → idle 时弹 Toast（结果 + 耗时，`agent/error` 记录的失败计入「出错」）；maintenance 阶段与子 agent 流程不通知。设置（`ext-center.notify`：总开关 / 提问开关 / 结束开关）在事件时实时读取，失败只记日志、绝不干扰 agent loop 与工具分发 |
| 人类命令 | `ctx.get("commands")` 存在时 `commands.register(...)` | `/rescue` 命令（状态 / apply / trigger）：无 GUI 宿主的急救交互面（dsh-TUI 等把注册表命令并入斜杠菜单）；Web 宿主也有该注册表，命令与对话框并存互不干扰 |
| 图片准入桥 | 包装 `ctx.llm.resolveModelInfo` | `vision.enabled` 时给当前模型信息追加 `image` 模态，通过宿主 api-gateway 的图片准入校验（`MODEL_DOES_NOT_SUPPORT_IMAGES`），让带图请求进入上面的 llm/stream 转述瀑布；关闭时原样返回 |
| 工作区解析 | `ctx.workspaceRegistry` | 文件树根目录（未配置时的默认来源） |
| 会话输入区 | `ctx.slots.inject("conversation.input.right", ...)` | 注册「优化输入」按钮；插槽渲染位置在上下文按钮左侧，因此真实 DOM 按钮由组件插入到发送按钮与上下文按钮之间；点击后经 `/ext/api/input/optimize` 用当前会话所选模型优化输入 |
| 侧栏底部操作 | `ctx.slots.inject("sidebar.footer.action", ...)` | 注册「文件树」与「归档」两个底部动作；归档面板读取 `sessions` / `workspaces` 标准快照展示已归档会话，删除经 `/ext/api/archive/delete` 回到宿主侧；另注册一个不可见的「急救模式」挂载点（`ext-center.rescue`，order 99）——组件本体不渲染任何按钮，只在宿主报告急救已生效时经 primitives 的 `Modal`（body portal）弹出全局对话框 |

### 路由表设计

`/ext/api` 前缀下是一张静态路由表：每个条目声明 `{ method, readsBody, mutating, requiresLocal, handler }`。调度器统一处理：

1. 路径与方法的匹配（404 / 405）；
2. 回环检查：`mutating || requiresLocal` 的端点默认只允许本机（`allowLan` 设置可放开）；
3. 读请求体（2 MiB 上限）；
4. 执行 handler，异常统一映射为 `{ ok:false, error:{ code, message } }`，成功为 `{ ok:true, value }`。

新增端点 = 往路由表加一行，不碰调度器。

## dsh-web-ui 兼容补丁

[dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) 全家桶（`@linxin666/*` 系列）提供与本插件重叠的界面元素：右侧文件树与 SCM 面板（`@linxin666/dsh-client-ui-aionui-panel`）、分支选择器与 Git 图谱（`@linxin666/dsh-client-ui-git-graph`）、Web 终端面板（`@linxin666/dsh-ssh`）、图像理解（`@linxin666/dsh-tool-describe-image`）。元素冲突时本插件**不加载自身对应功能，只启用 dsh-web-ui 的功能**：

| 本插件表面 | 被谁取代 |
| --- | --- |
| 侧栏文件树（`ext-center.tree`） | aionui-panel 文件树 |
| 对话页「Git」页签（`ext-center.git`） | aionui-panel SCM / git-graph |
| 对话页「终端」页签（`ext-center.terminal`） | dsh-ssh Web 终端 |
| 宿主侧图片转述 + 视觉能力桥 | describe-image（其 send hook 在客户端改写带图发送，转述瀑布根本看不到图片块） |

**检测规则**（`src/compat.ts` 纯函数）：按加载器条目 id（`ui-dsh-aionui-panel` / `ui-git-graph` / `ssh` / `describe-image`）或包名（`@linxin666/dsh-*`）匹配，且**只统计 ACTIVE（fiber state 2）且未禁用的条目**——全家桶插件 pending / 失败时它没有渲染任何元素，本插件保留自己的界面（fail-open）。两侧实现：

- **宿主侧**：`createDshWebUiGate(ctx)` 在 `apply()` 时同步快照一次，并在加载器树收敛（`waitForLoaderSettled`，8s 上限）后复查一次——兄弟 bundle 在本插件 apply 时可能仍在 pending，晚到的激活也要让位。决定按调用时读取（`suppressed("vision")`），因此转述监听器与能力桥注册时机不变，只是内部先查门；describe-image 生效时两者原样放行（桥恢复 api-gateway 原生模态校验）。
- **浏览器侧**：`src/client.js` 内联同一张家族表（bundle 无法 import TS，`tests/compat-client.spec.ts` 防漂移）。文件树 / Git / 终端三个 slot 注册放进一个延迟效应：等客户端加载器树收敛（同样 8s 上限、无加载器立即 fail-open）后，按抑制映射只注册不冲突的表面；其余表面（设置区块、急救弹窗、归档、优化输入）始终无条件注册。插件卸载时已注册的表面照常随效应释放。

宿主侧保留自己的终端/git/文件树 API 端点（与全家桶的 `/git/*`、`/api/dsh-ssh/*` 互不干扰）；让位只针对界面元素与功能重叠面。安装全家桶发生在运行期时，客户端 bundle 本来就需要刷新页面才出现，刷新后门禁自然生效。

## 持久化与一致性

- **cordis.patch.yml 是加载器树的唯一活源**：所有变更（插件安装/停用/卸载、MCP 行）都经同一个事务性写入器：解析 → 合并 → 临时文件 + rename 原子写，保留文件头注释，`!!js` 表达式（loader 配置方言）往返无损。连续写入串行化，避免配置监听器背靠背刷新。
- **`.dsh-ext-center.json`** 是 profile 目录下的侧车状态文件：记录包来源与补丁行，卸载/停用时据此精确移除对应行。
- **`.dsh-rescue.json`** 是急救模式的侧车状态文件（profile 目录下）：记录启动标记（pid / startedAt / healthy）、急救是否已生效（`phase: "applied"`）、触发原因与每个被禁用插件的名称与原因。每次启动写一个未定稿的 boot 记录，启动窗口（`rescue.settleMs`，默认 12s）过后无异常才标记 healthy；上一启动未定稿 = 启动失败，下一次启动据此进入急救模式。
- 插件安装 = 包落到共享模块根 `~/.dsh/profiles/node_modules` → 合并其 bundle 补丁行（无补丁的包自动补 `{id, name}` 行）→ HMR 配置监听器事务性重放，条目即时挂载。
- **Git 源构建回退**：`materializePackage` 对 git 源克隆后检查包声明的入口（`main` / `exports["."]`，见 `packageEntryPoints`）；入口缺失（仓库未提交构建产物，如 `lib/` 不存在）时自动执行 `npm install --no-audit --no-fund` 与 `npm run build`（`ensureBuiltPackage`，单步超时 10 分钟、输出只保留尾部 16 KiB，spawn 失败报 `build-tool-missing`，其余报 `build-failed` 并带输出尾部）。`npm install` 本身也会跑 `prepare` 钩子，所以只靠 `prepare` 出产物的仓库同样能恢复。构建成功与否经安装响应 `builtFromSource` 透出给客户端。npm / URL / folder 源不触发构建（发布产物理应已构建；folder 是用户本地目录，构建与否由用户负责）。
- **归档删除**：`/ext/api/archive/delete` 跳过仍加载/运行中的会话，删除其余已归档会话日志（经 `sessionPersistence.locate` 定位到会话目录后移除），并尽力从工作区记账中 detach；Harness 当前公开面没有 unarchive/delete session RPC，因此该操作是永久删除。

## 急救模式（rescue mode）

DeepSeek Harness 的启动审计（`assertEntriesActivated`）把任何第三方插件的加载失败视为致命错误：启动直接失败退出，用户面对「failed to start」。急救模式让下一次启动变得确定：

**触发条件**（全部在 `apply()` 的看门狗里检测，看门狗是 apply 的第一个动作）：

1. **上次启动未完成**：`.dsh-rescue.json` 里的 boot 记录未在启动窗口内被标记 healthy（进程在启动阶段崩溃/退出）；
2. **启动期第三方条目失败**：live loader 里第三方条目（名称不是本插件、不是 `@deepseek-ai/*`、不是 `cordis:*`）的 fiber 处于 failed / 无 fiber / 卡 pending（settle 检查才计入后两者，apply 时刻它们与「仍在加载」无法区分）；
3. **重复的加载器条目 id**：补丁列表内或与第三方 bundle 层之间的 id 冲突（`duplicate loader entry id` 会让 loader 树在启动时崩溃）。

**急救行为**：

1. 除本插件外所有第三方插件默认全部禁用：patch 行原地加 `disabled: true`（无 `name` 的纯配置覆盖行、已禁用行、harness 核心行一律不碰）；第三方 profile bundle（`dsh.profile.bundles` 中非核心项）按其自身 `dsh.bundle.patch` 声明的行 id 追加 `{id, disabled: true}` 补丁行；
2. 禁用写进 `cordis.patch.yml` 后由配置监听器**热生效**——运行中的树立即变成最小化配置，后续每次启动也直接按最小化配置组合。「以最小化配置重启」在桌面宿主下不杀进程：桌面 supervisor 把宿主意外退出视为整个应用退出，热生效即等价于最小化重启；裸 `dsh web`（无 supervisor）在用户确认恢复时才真正重启进程（`process.execPath` + 原 argv，detached + 400ms 后退出，先回响应）；
3. 启动成功后客户端轮询 `/ext/api/rescue/status`（5s），`phase === "applied"` 时经 sidebar footer 挂载点弹出全局对话框：列出每个被禁用插件的名称与原因（fiber 失败时尽力抓取真实报错），可多选，提供「全部恢复」「保持禁用」「启用所选并重新加载」；
4. 用户确认后 `POST /ext/api/rescue/apply { enable: [...] }` 事务性写回补丁（所选插件移除 disabled、其余保持禁用），状态清为 idle，然后按宿主形态刷新页面或重启进程；空选择 = 保持禁用、不重载。重启/刷新前把当前 boot 记为 healthy，避免「恢复 → 重启 → 又被判为启动失败」的循环；真正失败的下一启动仍会留下自己的未定稿标记，从而再次进入急救。

**状态机**（`phase`）：`idle`（正常监控）→ `applied`（急救已生效，弹窗待决）→ 用户确认后回 `idle`。`applied` 状态下再次启动不会重复禁用（最小化配置已持久化），弹窗继续出现直到用户决定。手动触发走 `POST /ext/api/rescue/trigger`（插件页「进入急救模式」按钮）或 `/rescue trigger` 命令（无 GUI 宿主），与自动触发同一路径。**恢复入口随宿主形态切换**：Web 宿主用对话框 + `/ext/api/rescue/apply`；无 `webServer` 的宿主（如 dsh-TUI）用 `/rescue apply` 命令——两者调用同一组纯函数（`buildRestorePlan` / `resolveRescue`），行为一致。

**前门 bundle 保护**：无 `webServer` 服务的宿主里，急救把「把自己挂载为加载器行的第三方 bundle」（insert 行 `name` 等于自身包名）判定为宿主界面本身（例如 dsh-TUI 的 `dsh-tui` 行），其全部行 id 加入保护名单，禁用计划跳过——否则急救会禁用掉终端界面自身，而终端没有恢复对话框，宿主将永远无法恢复。Web 宿主总是有 harness 核心的 web 前门，不做此保护。显式名单 `rescue.protectBundles` 兜底追加。

**安全与健壮性**：本插件自身行与 harness 核心行永不被禁用，急救不依赖任何第三方插件（其全部功能——路由、设置、终端、git、MCP、视觉、Tavily——照常工作）；看门狗与侧车写入全程异常安全（任何失败只记日志，绝不把本插件自身的 apply 弄挂，否则启动审计会连带杀死急救本身）；恢复只移除急救自己添加的禁用标记（bundle 禁用行要求恰好 `{id, disabled: true}` 两键才删除，手改过的行不删）。

**启动竞态修订**：apply 时的急救计划可能早于 `webServer` 服务激活——Web 宿主会被误判为无头，把自我挂载的第三方 bundle 当作前门保护起来（多禁少禁的保守方向）。settle 窗口结束时用已确定的宿主形态重跑同一计划器，只写增量（新增的 bundle 禁用行热生效），并把新禁用的插件并入状态清单；真无头宿主下状态未变，修订是 no-op。配套地，重复 id 检测只统计 `insert` 行与 bundle 层声明的 id——独立行是 id 定向覆盖（合并进既有条目），急救自己写的 `{id, disabled: true}` 行与 bundle 层同 id 是合并关系、不算重复，否则每次急救过的 bundle 都会让 settle 永远无法把启动标记为健康。

## 无头 / TUI 宿主适配（headless & TUI hosts）

[dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) 一类的终端宿主用 `dsh-base` 组合自建宿主进程，**不挂载 `webServer` 服务**。本插件的静态注入只声明必需的 `tools`，`webServer` 是可选项：apply 时服务已就绪就立即挂载 `/ext/api` 前缀路由；尚未就绪（include 加载的条目与 web-app 组合并发启动，服务晚于本 fiber 激活）则监听 `internal/service` 事件，服务激活或替换（webServer 热重载）时补挂——同一 `whenService` 机制也用于 `/rescue` 命令（`commands` 注册表）与自定义技能提供者（`skills` 服务）的晚到等待，避免一次性 `ctx.get()` 静默丢失表面。路由挂载不吃启动顺序的竞态，真无头宿主里监听器随 fiber 释放、不产生 pending fiber，只在 30s 启动窗口后记一条「API not mounted」日志。其余不依赖 GUI 的功能原样工作：

- **急救模式**：看门狗、`.dsh-rescue.json` 侧车、补丁写入与 settle 判定全部是宿主侧逻辑，无 web 依赖；恢复交互改走 **`/rescue` 斜杠命令**（挂载 dsh-commands 注册表时自动注册，dsh-TUI 会把注册表命令并入其斜杠菜单并分发）：`/rescue`（状态）、`/rescue apply all|none|<插件名,...>`（恢复选择，空选择 = 保持禁用）、`/rescue trigger`（手动进入）。命令输出即状态视图的文本渲染，恢复走与 `/ext/api/rescue/apply` 完全相同的 `resolveRescue` 路径（含事务性补丁写入与按宿主形态重载：桌面刷新页面 / 命令行宿主重启进程）。
- **前门保护**：见「急救模式 → 前门 bundle 保护」。
- **其余宿主侧功能**：设置命名空间（`dsh-base` 自带 `settings` 服务）、自定义技能目录、`tavily_search` 工具与提示引导、工具参数修复、图片转述与视觉能力桥——全部按原逻辑注册，仅 `/ext/api` 路由、终端/git/MCP 面板端点与 Web 客户端表面不挂载。

## 配置与安全不变量

部署可调项（树/终端/git/mcp/vision 上限、修复开关与占位文案、客户端轮询间隔、急救模式开关与启动窗口、急救保护名单 `rescue.protectBundles`）全部是 `ext-center` 行 `config:` 块中经 schemastery 校验的字段（`ConfigSchema`）：每个字段自带默认值与合法范围，非法值让插件**加载失败并给出明确报错**（响亮失败，不静默漂移）。

安全不变量保持固定、不可配置：

- 请求体 2 MiB、树文件读取/写入 1 MiB、终端单次写入 4096 字符、git 单批路径 500 条、归档删除单批 500 条、输入优化单次文本 100 KiB；
- git 子进程 `GIT_TERMINAL_PROMPT=0`（防挂起），路径拒绝控制字节（`[\0\r\n]`）；
- 技能名与 git 分支名有白名单校验；变更类接口默认仅回环可调用。

## 客户端结构

`src/client.js` 是构建产物格式的浏览器模块（`__ModuleLoader__.load({ id, factory })` 工厂），由 boot manifest 注入。它在设置页注册「更好的 DeepSeek Harness」区块（含「Tavily」页签：API Key 可见性切换、搜索深度、最大结果数、原始内容与总开关；「GitHub」页签：总开关与可选的 Token 配置——Token 仅写入不回显；「通知」页签：Windows 通知总开关与提问/结束两个子开关——保存/重置/格式校验全部回到 /ext/api/config），并通过 `conversation.view` slot 提供「终端」「Git」页签、在侧栏底部提供文件树与归档面板、通过 `conversation.input.right` slot 提供「优化输入」按钮（真实 DOM 节点定位在发送按钮与上下文按钮之间）。文件树 / Git / 终端三个表面经 dsh-web-ui 兼容门延迟注册（见「dsh-web-ui 兼容补丁」），其余表面无条件注册。归档面板从 `sessions` / `workspaces` 标准快照读取已归档会话，支持勾选后批量调用 `/ext/api/archive/delete` 永久删除。急救弹窗经侧栏底部一个不可见挂载点渲染：轮询 `/ext/api/rescue/status`，`phase === "applied"` 时用 primitives 的 `Modal`（body portal 全局限层）列出被禁用的第三方插件（名称 + 原因）供多选恢复。所有数据经 `fetch` 调 /ext/api；`/ext/api/state` 的 `limits` 块携带各上限与轮询间隔，界面文案与节奏自动跟随。客户端本身不做任何写入决策——一切变更都回到宿主侧的同一组端点。

## 模块职责

- `src/index.js`：宿主侧入口，导出 `{ NAME, SETTINGS_NS, apply, inject, materializePackage, packageEntryPoints, packageEntryExists, ensureBuiltPackage, __setRescueHostHooks }`；`apply(ctx, config)` 是插件主体，按固定顺序注册各效应（**急救看门狗最先跑**，同步补丁写入要抢在启动审计前），并提供 `/ext/api/input/optimize` 输入优化端点、`/ext/api/archive/delete` 归档删除端点与 `/ext/api/rescue/*` 急救端点。后五个导出是内部件（安装流水线 / 急救宿主副作用），导出仅为测试可及（行为规格在 `tests/host-wiring.spec.ts`）。
- `src/rescue.ts`：纯函数模块（状态机 `emptyRescueState`/`withBoot`/`markBootHealthy`/`previousBootFailed`/`sanitizeRescueState`、第三方条目分类、重复 id 检测、`buildRescuePlan` 禁用计划（含 `protectLayerNames` 前门保护参数）、`buildRestorePlan` 恢复计划、`rescueStatusView`），无任何 I/O，是急救逻辑的主测试战场（`tests/rescue.spec.ts`）。
- `src/compat.ts`：纯函数模块（`DSH_WEB_UI_FAMILY` 家族注册表、`detectDshWebUi` 存在性检测、`dshWebUiSuppression` 界面让位映射），无任何 I/O，是 dsh-web-ui 兼容决策的主测试战场（`tests/compat.spec.ts`）；浏览器侧内联同表（`tests/compat-client.spec.ts` 防漂移）。
- `src/client.js`：浏览器侧（见上），另注册「优化输入」按钮并定位到发送按钮与上下文按钮之间。
- `src/tool-args.ts`：纯函数模块（`tryParseJsonObject` / `repairToolArguments`），无任何 I/O，是工具参数单测的主战场。
- `src/ansi.ts`：纯函数模块（`stripAnsiChunk`），无任何 I/O，流式剥离终端输出里的 ANSI CSI/OSC 转义序列。
- `src/terminal-buffer.ts`：纯函数模块（`createTerminalBuffer` / `appendTerminalBuffer` / `terminalBufferSlice`），无任何 I/O，维护终端输出的字节环；客户端用绝对字节 offset 轮询，截断后仍能拿到正确增量。
- `src/tavily.ts`：纯函数模块（Tavily 设置默认值 / API Key 校验 / 请求体构建 / 响应映射 / 结果格式化），无任何 I/O，宿主侧只负责接线 `fetch` 与工具注册。
- `src/github.ts`：纯函数模块（GitHub 设置默认值 / Token 校验 / owner-repo 与路径解析 / 端点 URL 构建 / 请求头 / 响应映射（仓库信息、contents 目录与文件、仓库搜索、发布列表）/ 错误映射 / 结果格式化），无任何 I/O，宿主侧只负责接线 `fetch` 与五个工具注册。
- `src/notify.ts`：纯函数模块（通知设置默认值 / 平台门 / 文本截断与 PowerShell 单引号转义 / 提问与结束通知文案构建 / 完整 PowerShell Toast 脚本构建 / agent 流程追踪状态机），无任何 I/O，宿主侧只负责接线事件监听与 PowerShell/Electron 弹出（宿主副作用经 `__setNotifyHostHooks` 可注入，供测试覆盖）。
