# better-deepseek-harness 架构

阅读本文后再改动本插件的任何代码。它假设你了解 Cordis 与 DeepSeek Harness 的基础概念；若不了解，先读 Harness 的 [架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) 与 [Cordis 入门](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)。

本插件遵循 Harness 的核心原则：**一切皆插件**。它没有特权核心，只是作为 `ext-center` 行挂载在 profile 的插件树里；所有注册都是可回退的效应（`ctx.effect`），插件卸载时一并释放。

## 两半结构

| 半 | 文件 | 运行环境 | 职责 |
| --- | --- | --- | --- |
| 宿主侧 | `src/index.js` | dsh 主机进程（Node） | 设置命名空间、/ext/api 路由、技能/插件生命周期、文件树、终端、git、MCP、图片转述、工具参数修复 |
| 客户端 | `src/client.js` | 浏览器（Web UI） | 设置页「更好的 DeepSeek Harness」区块、对话页「终端」「Git」页签、侧栏文件树 |
| 纯逻辑 | `src/tool-args.ts`、`src/ansi.ts`、`src/tavily.ts`、`src/terminal-buffer.ts` | 宿主侧 | 模型工具参数的 JSON 恢复与 description 修补；终端 ANSI 转义序列的流式剥离；Tavily 设置/请求/响应纯函数；终端输出字节环与增量 offset 语义 |

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
| 图片准入桥 | 包装 `ctx.llm.resolveModelInfo` | `vision.enabled` 时给当前模型信息追加 `image` 模态，通过宿主 api-gateway 的图片准入校验（`MODEL_DOES_NOT_SUPPORT_IMAGES`），让带图请求进入上面的 llm/stream 转述瀑布；关闭时原样返回 |
| 工作区解析 | `ctx.workspaceRegistry` | 文件树根目录（未配置时的默认来源） |
| 会话输入区 | `ctx.slots.inject("conversation.input.right", ...)` | 注册「优化输入」按钮；插槽渲染位置在上下文按钮左侧，因此真实 DOM 按钮由组件插入到发送按钮与上下文按钮之间；点击后经 `/ext/api/input/optimize` 用当前会话所选模型优化输入 |
| 侧栏底部操作 | `ctx.slots.inject("sidebar.footer.action", ...)` | 注册「文件树」与「归档」两个底部动作；归档面板读取 `sessions` / `workspaces` 标准快照展示已归档会话，删除经 `/ext/api/archive/delete` 回到宿主侧 |

### 路由表设计

`/ext/api` 前缀下是一张静态路由表：每个条目声明 `{ method, readsBody, mutating, requiresLocal, handler }`。调度器统一处理：

1. 路径与方法的匹配（404 / 405）；
2. 回环检查：`mutating || requiresLocal` 的端点默认只允许本机（`allowLan` 设置可放开）；
3. 读请求体（2 MiB 上限）；
4. 执行 handler，异常统一映射为 `{ ok:false, error:{ code, message } }`，成功为 `{ ok:true, value }`。

新增端点 = 往路由表加一行，不碰调度器。

## 持久化与一致性

- **cordis.patch.yml 是加载器树的唯一活源**：所有变更（插件安装/停用/卸载、MCP 行）都经同一个事务性写入器：解析 → 合并 → 临时文件 + rename 原子写，保留文件头注释，`!!js` 表达式（loader 配置方言）往返无损。连续写入串行化，避免配置监听器背靠背刷新。
- **`.dsh-ext-center.json`** 是 profile 目录下的侧车状态文件：记录包来源与补丁行，卸载/停用时据此精确移除对应行。
- 插件安装 = 包落到共享模块根 `~/.dsh/profiles/node_modules` → 合并其 bundle 补丁行（无补丁的包自动补 `{id, name}` 行）→ HMR 配置监听器事务性重放，条目即时挂载。
- **Git 源构建回退**：`materializePackage` 对 git 源克隆后检查包声明的入口（`main` / `exports["."]`，见 `packageEntryPoints`）；入口缺失（仓库未提交构建产物，如 `lib/` 不存在）时自动执行 `npm install --no-audit --no-fund` 与 `npm run build`（`ensureBuiltPackage`，单步超时 10 分钟、输出只保留尾部 16 KiB，spawn 失败报 `build-tool-missing`，其余报 `build-failed` 并带输出尾部）。`npm install` 本身也会跑 `prepare` 钩子，所以只靠 `prepare` 出产物的仓库同样能恢复。构建成功与否经安装响应 `builtFromSource` 透出给客户端。npm / URL / folder 源不触发构建（发布产物理应已构建；folder 是用户本地目录，构建与否由用户负责）。
- **归档删除**：`/ext/api/archive/delete` 跳过仍加载/运行中的会话，删除其余已归档会话日志（经 `sessionPersistence.locate` 定位到会话目录后移除），并尽力从工作区记账中 detach；Harness 当前公开面没有 unarchive/delete session RPC，因此该操作是永久删除。

## 配置与安全不变量

部署可调项（树/终端/git/mcp/vision 上限、修复开关与占位文案、客户端轮询间隔）全部是 `ext-center` 行 `config:` 块中经 schemastery 校验的字段（`ConfigSchema`）：每个字段自带默认值与合法范围，非法值让插件**加载失败并给出明确报错**（响亮失败，不静默漂移）。

安全不变量保持固定、不可配置：

- 请求体 2 MiB、树文件读取/写入 1 MiB、终端单次写入 4096 字符、git 单批路径 500 条、归档删除单批 500 条、输入优化单次文本 100 KiB；
- git 子进程 `GIT_TERMINAL_PROMPT=0`（防挂起），路径拒绝控制字节（`[\0\r\n]`）；
- 技能名与 git 分支名有白名单校验；变更类接口默认仅回环可调用。

## 客户端结构

`src/client.js` 是构建产物格式的浏览器模块（`__ModuleLoader__.load({ id, factory })` 工厂），由 boot manifest 注入。它在设置页注册「更好的 DeepSeek Harness」区块（含「Tavily」页签：API Key 可见性切换、搜索深度、最大结果数、原始内容与总开关，保存/重置/格式校验全部回到 /ext/api/config），并通过 `conversation.view` slot 提供「终端」「Git」页签、在侧栏底部提供文件树与归档面板、通过 `conversation.input.right` slot 提供「优化输入」按钮（真实 DOM 节点定位在发送按钮与上下文按钮之间）。归档面板从 `sessions` / `workspaces` 标准快照读取已归档会话，支持勾选后批量调用 `/ext/api/archive/delete` 永久删除。所有数据经 `fetch` 调 /ext/api；`/ext/api/state` 的 `limits` 块携带各上限与轮询间隔，界面文案与节奏自动跟随。客户端本身不做任何写入决策——一切变更都回到宿主侧的同一组端点。

## 模块职责

- `src/index.js`：宿主侧入口，导出 `{ NAME, SETTINGS_NS, apply, inject, materializePackage, packageEntryPoints, packageEntryExists, ensureBuiltPackage }`；`apply(ctx, config)` 是插件主体，按固定顺序注册各效应，并提供 `/ext/api/input/optimize` 输入优化端点与 `/ext/api/archive/delete` 归档删除端点。后四个导出是安装流水线内部件，导出仅为测试可及（行为规格在 `tests/host-wiring.spec.ts`）。
- `src/client.js`：浏览器侧（见上），另注册「优化输入」按钮并定位到发送按钮与上下文按钮之间。
- `src/tool-args.ts`：纯函数模块（`tryParseJsonObject` / `repairToolArguments`），无任何 I/O，是工具参数单测的主战场。
- `src/ansi.ts`：纯函数模块（`stripAnsiChunk`），无任何 I/O，流式剥离终端输出里的 ANSI CSI/OSC 转义序列。
- `src/terminal-buffer.ts`：纯函数模块（`createTerminalBuffer` / `appendTerminalBuffer` / `terminalBufferSlice`），无任何 I/O，维护终端输出的字节环；客户端用绝对字节 offset 轮询，截断后仍能拿到正确增量。
- `src/tavily.ts`：纯函数模块（Tavily 设置默认值 / API Key 校验 / 请求体构建 / 响应映射 / 结果格式化），无任何 I/O，宿主侧只负责接线 `fetch` 与工具注册。
