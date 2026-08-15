# 贡献指南（better-deepseek-harness）

> 欢迎为 better-deepseek-harness 贡献代码、文档或 issue。本文件是软件开发与贡献的入口——**实现态的技术细节**（架构、目录结构、构建/测试流程）都在这里，README 只保留面向最终用户的安装与使用说明。

本仓库是独立的 DeepSeek Harness 插件仓库（不是 Harness monorepo 的一部分）：宿主侧 + 浏览器侧 + 纯逻辑三个模块，构建产物提交进 git。**改动代码前请先阅读**：

- [docs/architecture.md](docs/architecture.md) —— 架构契约：扩展点（能力接缝）、路由表设计、持久化一致性、安全不变量、模块职责。改代码前必须读。
- [docs/development.md](docs/development.md) —— 开发流程：命令、测试策略、编码约定、TypeScript 渐进式迁移、发布与安装。

## 目录

- [入门](#入门)
- [实现要点](#实现要点)
- [目录结构](#目录结构)
- [开发](#开发)
- [测试](#测试)
- [编码约定](#编码约定)
- [提交与发布](#提交与发布)

## 入门

前置：Node.js 22.19+（与 Harness 运行时一致），npm 即可（不需要 pnpm）。

```sh
npm install          # 安装依赖（vitest、typescript 及运行时依赖）
npm run typecheck    # tsc --noEmit（strict；覆盖 src 与 tests）
npm test             # vitest 单测
npm run build        # tsc 发射 src/* → lib/*（产物与源码同名）
npm run check        # typecheck + test
```

## 实现要点

- **插件安装链路**：包落到 `~/.dsh/profiles/node_modules`（profile 解析链上的共享根）→ 合并该包在 package.json `dsh.bundle.patch` 中声明的补丁行（若有）；无补丁的包自动补一条 `{id: <包名>, name: <包名>}` 行保证可加载 → HMR 配置监听器事务性重放，条目即时挂载
- **patch 写入一致性**：所有 `cordis.patch.yml` 写入都是「解析 → 合并 → 临时文件 + rename 原子写」，保留文件头注释；`!!js` 表达式（loader 配置方言）往返无损；连续写入间隔串行化，避免监听器背靠背刷新
- **状态记账**：包来源与补丁行记录在 profile 目录的 `.dsh-ext-center.json`（卸载 / 停用时据此精确移除对应行）
- **配置落盘**：本插件的偏好落在原生 `ctx.settings` 命名空间（`ext-center`）；该命名空间不在 api-proxy 的浏览器白名单里，因此设置页通过本插件自己的 `/ext/api/state` 与 `/ext/api/config` 读写（后者在宿主侧用 settings service 落盘）
- **配置校验**：部署可调项是 ext-center 行 `config:` 块中经 schemastery 校验的 Config 字段，加载即校验，非法值响亮失败；安全不变量保持常量
- **注册即效应**：settings 命名空间经 `ctx.inject(["settings"], ...)` 等待服务就绪后注册（与 dsh-settings 的 `installSettingsSection` 同模式，插件先于 settings 启动也不丢命名空间）；所有 `register()` 返回的 disposer 挂进 `ctx.effect`，插件卸载时一并释放
- **工具参数修复**：通过 `tools/execute` waterfall（与 `dsh-tool-call-timeout-policy` 同机制）在参数校验前修复模型生成的工具参数；只修安全的 `description` 与可恢复的 JSON 字符串，绝不伪造 `code` / `command` 等内容字段；`toolRepair.enabled` 可整体关闭、`descriptionFill` 可换占位文案
- **图片转述瀑布**：`llm/stream` 监听器返回异步可迭代对象（async generator），与瀑布「最外层返回值必须是 async iterable」的约定一致；启用开关通过包装 `llm.resolveModelInfo` 解除宿主 api-gateway 的图片准入限制
- **优化输入**：按钮挂在 `conversation.input.right`；因插槽渲染位置在上下文按钮左侧，组件把真实 DOM 按钮插入到发送按钮之前。点击后客户端从 `modelDirectories` 读取当前会话所选 provider/model（缺失时回退到最近一条助手消息的 `requestConfig`），调用 `/ext/api/input/optimize`，宿主侧用 `ctx.llm.stream` 做一次性辅助模型调用并回填结果
- **Tavily 集成**：`tavily_search` 工具经 `ctx.tools.register` 注册、提示引导经 `systemPrompt.section` 注入，两者随 `ext-center.tavily.enabled`（settings 命名空间 `watch`）联动注册 / 注销；执行时读取实时设置，未启用 / 未配置 / 调用失败抛清晰错误，由 agent loop 转为工具错误结果，不阻塞回答
- **文件树根解析**：`treeRoot` 设置 → `ctx.workspaceRegistry` 最近注册的工作区 → 进程 `cwd`；未配置时默认展示最近使用的工作区

## 目录结构

```
better-deepseek-harness/
├── package.json          # 入口、dsh.bundle.patch + dsh.client 声明、scripts（build/test/typecheck）
├── cordis.patch.yml      # bundle 补丁：插入 ext-center 行
├── install.ps1           # 一键安装脚本（方式一，跳过 .git 与 node_modules）
├── tsconfig.json         # 类型检查（strict，noEmit）
├── tsconfig.build.json   # 构建：tsc 发射 src/*.ts → lib/，JS 由 copy-js.mjs 原样复制
├── scripts/copy-js.mjs   # 构建时把 index.js / client.js 逐字节复制到 lib/
├── src/                  # 源码
│   ├── index.js          # 主机侧：settings 命名空间、/ext/api 路由、技能/插件生命周期、
│   │                     #   文件树读写、工具参数修复、图片转述、MCP、Tavily 工具注册
│   ├── client.js         # 浏览器侧：设置页区块（技能/插件/MCP/Tavily/设置页签）、
│   │                     #   终端/Git 页签、侧栏文件树、输入优化按钮（__ModuleLoader__ 工厂格式）
│   ├── tool-args.ts      # 模型工具参数修复纯函数（构建后为 lib/tool-args.js）
│   ├── ansi.ts           # 终端 ANSI 转义流式剥离纯函数（构建后为 lib/ansi.js）
│   ├── terminal-buffer.ts # 终端输出字节环：截断安全的增量 offset（构建后为 lib/terminal-buffer.js）
│   └── tavily.ts         # Tavily 搜索纯函数：默认值 / 校验 / 请求 / 映射 / 格式化（构建后为 lib/tavily.js）
├── tests/                # vitest 规格（tool-args / ansi / terminal-buffer / tavily / host-wiring / built-smoke）
├── docs/                 # docs/architecture.md（架构）、docs/development.md（开发指南）
├── lib/                  # 构建产物（npm run build 生成并提交进 git —— 安装方无需任何构建工具）
└── CONTRIBUTING.md
```

## 开发

- `npm run typecheck`（strict 类型检查）、`npm test`（vitest）、`npm run build`（tsc 发射 `src/` → `lib/`）、`npm run check`（typecheck + test）——完整流程与构建细节见 docs/development.md。
- `lib/` 是提交进 git 的构建产物：改完 `src/` 后必须 `npm run build` 并提交新的 `lib/`，否则安装方拿不到改动（安装流程不执行构建）。

## 测试

- `tests/tool-args.spec.ts`：纯逻辑（JSON 恢复、description 修补）的行为规格，是回归的主战场。
- `tests/ansi.spec.ts`：终端 ANSI 剥离（CSI/OSC、跨 chunk 的未完成序列）的行为规格。
- `tests/host-wiring.spec.ts`：用最小 ctx 双（mock）跑 `apply()`，断言接线（路由、设置命名空间、技能 provider、两个瀑布）与路由调度器（200/403/404/405、错误信封）；不触真实文件系统与网络。
- `tests/terminal-buffer.spec.ts`：终端输出字节环（截断后 offset 语义、UTF-8 边界对齐）的行为规格。
- `tests/built-smoke.spec.ts`：构建产物契约——`lib/` 的 JS 与 `src/` 逐字节一致，且 `lib/` 入口能在纯 Node ESM 下加载运行。

新增行为先写测试再实现；纯函数进 `tool-args.ts`（或新的纯模块），有 I/O 的逻辑通过 ctx 双在 `host-wiring.spec.ts` 中覆盖。

## 编码约定

- ESM 全局（`"type": "module"`）；相对导入带 `.js` 后缀（NodeNext 解析）。
- 注册即效应：一切注册走 `ctx.effect` / `ctx.on`，disposer 挂进效应，插件卸载时一并释放。
- 部署可调项是 `ConfigSchema`（schemastery）字段，非法值响亮失败；安全不变量保持常量（见 docs/architecture.md）。
- 显式优先：默认值在实现里显式解析，不在 `run()` 里藏 `?? default`。
- TODO 标记：`FIXME`（阻塞发布）/ `TODO`（尽快修）/ `XXX`（有生之年）。
- 文件以单个换行结尾；提交前 `git diff --cached --check`。
- 渐进式 TypeScript：`src/tool-args.ts`、`src/ansi.ts`、`src/tavily.ts`、`src/terminal-buffer.ts` 已是完整 TypeScript（strict 通过）；`src/index.js` 与 `src/client.js` 仍是带 JSDoc 的 JS（`checkJs` 未开启）。迁移路径见 docs/development.md——新增代码写 `.ts`。

## 提交与发布

- 文档随代码走：行为变化同步更新 README 与 docs/architecture.md。
- 发布前跑 `npm run check`；改动 `src/` 后必须重新 `npm run build` 并提交 `lib/`。
- npm 发布按 `files` 白名单打包（lib、src、tests、docs、cordis.patch.yml、README.md、CONTRIBUTING.md）；安装方不需要任何构建工具。
- 安装与发布细节见 docs/development.md「发布与安装」。
