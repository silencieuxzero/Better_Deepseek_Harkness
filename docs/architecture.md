# better-deepseek-harness 架构

阅读本文后再改动本插件的任何代码。它假设你了解 Cordis 与 DeepSeek Harness 的基础概念；若不了解，先读 Harness 的 [架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) 与 [Cordis 入门](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)。

本插件遵循 Harness 的核心原则：**一切皆插件**。它没有特权核心，只是作为 `ext-center` 行挂载在 profile 的插件树里；所有注册都是可回退的效应（`ctx.effect`），插件卸载时一并释放。

## 两半结构

| 半 | 文件 | 运行环境 | 职责 |
| --- | --- | --- | --- |
| 宿主侧 | `src/index.js` | dsh 主机进程（Node） | 设置命名空间、/ext/api 路由、技能/插件生命周期、文件树、终端、git、MCP、图片转述、工具参数修复 |
| 客户端 | `src/client.js` | 浏览器（Web UI） | 设置页「更好的 DeepSeek Harness」区块、对话页「终端」「Git」页签、侧栏文件树 |
| 纯逻辑 | `src/tool-args.ts` | 宿主侧 | 模型工具参数的 JSON 恢复与 description 修补（唯一完整 TypeScript 化的模块） |

`package.json` 的 `dsh` 字段声明了这个插件如何进入运行时：

- `dsh.bundle.patch: "cordis.patch.yml"`：bundle 补丁，插入 `ext-center` 行；
- `dsh.client.inject`：客户端注入的运行时依赖（client-runtime、locale、ui-slots、ui-sidebar、ui-primitives）；
- `dsh.client.platform: "web"`：客户端目标平台。

## 扩展点（能力接缝）

新行为一律挂在文档化的扩展点上，绝不修改 agent-loop 本身。本插件用到的接缝：

| 目标 | 接缝 | 用途 |
| --- | --- | --- |
| 插件自身偏好 | `ctx.settings.register(SETTINGS_NS, SettingsSchema, { base: DEFAULTS })` | `ext-center` 设置命名空间，写入 settings.yaml |
| HTTP API | `ctx.webServer.register({ kind: "prefix", path: "/ext/api", handler })` | 全部 /ext/api 端点 |
| 自定义技能目录 | `skills.registerProvider(...)` | 把 `customSkillDirs` 中的技能提供给所有会话 |
| 拦截工具调用 | `ctx.on("tools/execute", ...)` 瀑布 | 参数校验前修复 description 缺失与损坏 JSON（与 `dsh-tool-call-timeout-policy` 同机制） |
| 拦截模型请求 | `ctx.on("llm/stream", ...)` 瀑布 | 含图片的请求先由视觉模型转述成文字 |
| 工作区解析 | `ctx.workspaceRegistry` | 文件树根目录（未配置时的默认来源） |

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

## 配置与安全不变量

部署可调项（树/终端/git/mcp/vision 上限、修复开关与占位文案、客户端轮询间隔）全部是 `ext-center` 行 `config:` 块中经 schemastery 校验的字段（`ConfigSchema`）：每个字段自带默认值与合法范围，非法值让插件**加载失败并给出明确报错**（响亮失败，不静默漂移）。

安全不变量保持固定、不可配置：

- 请求体 2 MiB、树文件读取/写入 1 MiB、终端单次写入 4096 字符、git 单批路径 500 条；
- git 子进程 `GIT_TERMINAL_PROMPT=0`（防挂起），路径拒绝控制字节（`[\0\r\n]`）；
- 技能名与 git 分支名有白名单校验；变更类接口默认仅回环可调用。

## 客户端结构

`src/client.js` 是构建产物格式的浏览器模块（`__ModuleLoader__.load({ id, factory })` 工厂），由 boot manifest 注入。它在设置页注册「更好的 DeepSeek Harness」区块，并通过 `conversation.view` slot 提供「终端」「Git」页签、在侧栏底部提供文件树。所有数据经 `fetch` 调 /ext/api；`/ext/api/state` 的 `limits` 块携带各上限与轮询间隔，界面文案与节奏自动跟随。客户端本身不做任何写入决策——一切变更都回到宿主侧的同一组端点。

## 模块职责

- `src/index.js`：宿主侧入口，导出 `{ NAME, SETTINGS_NS, apply, inject }`；`apply(ctx, config)` 是插件主体，按固定顺序注册各效应。
- `src/client.js`：浏览器侧（见上）。
- `src/tool-args.ts`：纯函数模块（`tryParseJsonObject` / `repairToolArguments`），无任何 I/O，是唯一完整 TypeScript 化的模块，也是单测的主战场。
