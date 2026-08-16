# 开发指南（better-deepseek-harness）

本仓库是独立插件仓库（非 Harness monorepo 的一部分），目录结构对齐 Harness 的包约定：`src/` 源码、`tests/` 测试、`docs/` 文档、`lib/` 构建产物（生成但不提交）。参考 Harness 的 [development.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md) 与 [architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)。

## 布局

```
better-deepseek-harness/
├── package.json          # 入口、dsh.bundle.patch + dsh.client 声明、scripts
├── cordis.patch.yml      # bundle 补丁：插入 ext-center 行
├── install.ps1           # 一键安装脚本（复制仓库内容，自动 npm ci + 构建 lib/，跳过 .git 与 node_modules）
├── tsconfig.json         # 类型检查（strict，noEmit）
├── tsconfig.build.json   # 构建（tsc 发射到 lib/）
├── src/                  # 源码：index.js（宿主侧）、client.js（浏览器侧）、tool-args.ts / ansi.ts / tavily.ts / github.ts / notify.ts / terminal-buffer.ts / rescue.ts / compat.ts（纯逻辑）
├── tests/                # vitest 规格（*.spec.ts）
├── docs/                 # 架构与开发文档
├── lib/                  # 构建产物（npm run build 生成；不提交进 git，安装/测试时自动构建）
└── README.md
```

## 前置与命令

- Node.js 22.19+（与 Harness 运行时一致）；npm 即可，不需要 pnpm。

```sh
npm install          # 安装依赖（vitest、typescript 及运行时依赖），并触发 prepare 自动构建 lib/
npm run typecheck    # tsc --noEmit（strict；覆盖 src 与 tests）
npm test             # pretest 自动构建后运行 vitest 单测
npm run build        # tsc 发射：src/* → lib/*（产物与源码同名）
npm run check        # typecheck + test（test 前会先构建）
```

`lib/` 是构建产物但**不提交进 git**（已在 .gitignore 中）：`npm install` 通过 `prepare` 自动生成，`npm test` 通过 `pretest` 自动生成。安装流程（install.ps1 / 官方 `dsh plugin` / 手动复制后构建）也会在目标目录生成 `lib/`，不再依赖提交的构建产物。

注意：设置页「插件」页签的 **Git 源安装**是另一条路径——它克隆目标仓库后若发现其未提交构建产物（入口缺失），会自动 `npm install` + `npm run build` 补构建（见 docs/architecture.md「Git 源构建回退」）。本仓库现在也采用同样的「不提交 lib、安装时构建」策略。

## 构建

`npm run build` 用 tsc（`allowJs` 关闭）把 `src/*.ts` 发射到 `lib/*.js`（`ansi`、`tavily`、`github`、`notify`、`terminal-buffer`、`tool-args`、`rescue`、`compat`），再由 `scripts/copy-js.mjs` 把 `index.js`、`client.js` 原样复制到 `lib/`。产物与手写时代的旧文件保持同构——`package.json` 的 `main`/`exports` 与 `dsh.client.inject` 指向不变，运行时行为不变。`lib/` 是生成目录，不提交进 git。

调试急救模式时可对真实 profile 做只读预演（不写盘）：

```sh
node scripts/rescue-dry-run.mjs ~/.dsh/profiles/web
```

它解析该 profile 的 `cordis.patch.yml` 与第三方 bundle 层，打印重复 id、启动问题与将要执行的禁用计划。

## 测试

- `tests/tool-args.spec.ts`：纯逻辑（JSON 恢复、description 修补）的行为规格，是回归的主战场。
- `tests/ansi.spec.ts`：终端 ANSI 剥离（CSI/OSC、跨 chunk 的未完成序列）的行为规格。
- `tests/github.spec.ts`：GitHub 工具纯逻辑（设置解析、Token 校验、owner/repo 与路径解析、URL 构建、contents/搜索/发布响应映射、错误映射、结果格式化）的行为规格。
- `tests/notify.spec.ts`：Windows 通知纯逻辑（设置解析、平台门、文本截断与转义、文案构建、Toast 脚本构建、agent 流程追踪状态机）的行为规格。
- `tests/rescue.spec.ts`：急救模式纯逻辑（状态机、第三方分类、重复 id 检测、禁用/恢复计划、状态文件清洗）的行为规格。
- `tests/compat.spec.ts`：dsh-web-ui 兼容决策纯逻辑（家族注册表、按 id/包名检测、只统计 ACTIVE 条目、界面让位映射）的行为规格；`tests/compat-client.spec.ts` 守卫浏览器侧内联同表与 `src/compat.ts` 不漂移。
- `tests/host-wiring.spec.ts`：用最小 ctx 双（mock）跑 `apply()`，断言接线（路由、设置命名空间、技能 provider、两个瀑布）与路由调度器（200/403/404/405、错误信封）；不触真实文件系统与网络。另含安装流水线内部件的规格：`packageEntryPoints` / `packageEntryExists` / `ensureBuiltPackage`（构建回退的决策与报错，子进程用注入的假 runner，不跑真实 npm）。急救模式的宿主接线（看门狗、`/ext/api/rescue/*` 路由、重启/桌面探测钩子 `__setRescueHostHooks`）用临时 profile 目录夹具覆盖。
- `tests/terminal-buffer.spec.ts`：终端输出字节环（截断后 offset 语义、UTF-8 边界对齐）的行为规格。
- `tests/built-smoke.spec.ts`：构建产物契约——`npm test` 的 `pretest` 先生成 `lib/`，再断言 `lib/` 的 JS 与 `src/` 逐字节一致，且 `lib/` 入口能在纯 Node ESM 下加载运行。

新增行为先写测试再实现；纯函数进 `tool-args.ts`（或新的纯模块），有 I/O 的逻辑通过 ctx 双在 `host-wiring.spec.ts` 中覆盖。

## 约定

- ESM 全局（`"type": "module"`）；相对导入带 `.js` 后缀（NodeNext 解析）。
- 注册即效应：一切注册走 `ctx.effect` / `ctx.on`，disposer 挂进效应，插件卸载时一并释放。
- 部署可调项是 `ConfigSchema`（schemastery）字段，非法值响亮失败；安全不变量保持常量（见 docs/architecture.md）。
- 显式优先：默认值在实现里显式解析，不在 `run()` 里藏 `?? default`。
- TODO 标记：`FIXME`（阻塞发布）/ `TODO`（尽快修）/ `XXX`（有生之年）。
- 文件以单个换行结尾；提交前 `git diff --cached --check`。

## 渐进式 TypeScript 迁移

当前状态：`src/tool-args.ts`、`src/ansi.ts`、`src/tavily.ts`、`src/terminal-buffer.ts` 与 `src/rescue.ts` 是完整 TypeScript（strict 通过）；`src/index.js` 与 `src/client.js` 仍是带 JSDoc 的 JS，`checkJs` 未开启（历史代码无参数类型标注，开启会产生大量噪音）。迁移路径：

1. 逐个函数补 JSDoc 参数/返回类型，或直接转为 `.ts`；
2. 待 JS 文件类型覆盖率达标后开启 `checkJs: true`，再逐步收紧为 `strict`；
3. 最终目标：全部源码为严格 TypeScript，与 Harness 包一致。

## 发布与安装

- npm 发布按 `files` 白名单打包（lib、src、tests、docs、cordis.patch.yml、README.md）；`prepare` 会在打包前生成 `lib/`，因此从 npm tarball 安装不需要构建工具。
- 从 Git / `install.ps1` 安装时 `lib/` 不会随仓库提交，安装流程会执行 `npm ci` + 构建（`install.ps1` 已内置；`dsh plugin` 走 npm 的 `prepare`）。
- `install.ps1` 复制仓库（跳过 `.git` 与 `node_modules`）到 profile 共享模块根，自动安装依赖并生成 `lib/`，然后追加 `ext-center` 行（按 id 去重）；详见 README「安装」。
