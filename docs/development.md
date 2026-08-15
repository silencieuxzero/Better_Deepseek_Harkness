# 开发指南（better-deepseek-harness）

本仓库是独立插件仓库（非 Harness monorepo 的一部分），目录结构对齐 Harness 的包约定：`src/` 源码、`tests/` 测试、`docs/` 文档、`lib/` 构建产物。参考 Harness 的 [development.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md) 与 [architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)。

## 布局

```
better-deepseek-harness/
├── package.json          # 入口、dsh.bundle.patch + dsh.client 声明、scripts
├── cordis.patch.yml      # bundle 补丁：插入 ext-center 行
├── install.ps1           # 一键安装脚本（免构建，复制 lib/ 产物）
├── tsconfig.json         # 类型检查（strict，noEmit）
├── tsconfig.build.json   # 构建（tsc 发射到 lib/）
├── src/                  # 源码：index.js（宿主侧）、client.js（浏览器侧）、tool-args.ts（纯逻辑）
├── tests/                # vitest 规格（*.spec.ts）
├── docs/                 # 架构与开发文档
├── lib/                  # 构建产物（提交进 git，安装免构建）
└── README.md
```

## 前置与命令

- Node.js 22.19+（与 Harness 运行时一致）；npm 即可，不需要 pnpm。

```sh
npm install          # 安装依赖（vitest、typescript 及运行时依赖）
npm run typecheck    # tsc --noEmit（strict；覆盖 src 与 tests）
npm test             # vitest 单测
npm run build        # tsc 发射：src/* → lib/*（产物与源码同名）
npm run check        # typecheck + test
```

`lib/` 是构建产物且提交进 git：安装流程（install.ps1 / 手动复制）不执行任何构建，直接消费 `lib/`。改完 `src/` 后必须 `npm run build` 并提交新的 `lib/`，否则安装方拿不到改动。

## 构建

`npm run build` 用 tsc（`allowJs`）把 `src/` 发射到 `lib/`：`index.js`、`client.js` 原样复制，`tool-args.ts` 编译为 `tool-args.js`。产物与手写时代的旧文件保持同构——`package.json` 的 `main`/`exports` 与 `dsh.client.inject` 指向不变，运行时行为不变。

## 测试

- `tests/tool-args.spec.ts`：纯逻辑（JSON 恢复、description 修补）的行为规格，是回归的主战场。
- `tests/ansi.spec.ts`：终端 ANSI 剥离（CSI/OSC、跨 chunk 的未完成序列）的行为规格。
- `tests/host-wiring.spec.ts`：用最小 ctx 双（mock）跑 `apply()`，断言接线（路由、设置命名空间、技能 provider、两个瀑布）与路由调度器（200/403/404/405、错误信封）；不触真实文件系统与网络。
- `tests/built-smoke.spec.ts`：构建产物契约——`lib/` 的 JS 与 `src/` 逐字节一致，且 `lib/` 入口能在纯 Node ESM 下加载运行。

新增行为先写测试再实现；纯函数进 `tool-args.ts`（或新的纯模块），有 I/O 的逻辑通过 ctx 双在 `host-wiring.spec.ts` 中覆盖。

## 约定

- ESM 全局（`"type": "module"`）；相对导入带 `.js` 后缀（NodeNext 解析）。
- 注册即效应：一切注册走 `ctx.effect` / `ctx.on`，disposer 挂进效应，插件卸载时一并释放。
- 部署可调项是 `ConfigSchema`（schemastery）字段，非法值响亮失败；安全不变量保持常量（见 docs/architecture.md）。
- 显式优先：默认值在实现里显式解析，不在 `run()` 里藏 `?? default`。
- TODO 标记：`FIXME`（阻塞发布）/ `TODO`（尽快修）/ `XXX`（有生之年）。
- 文件以单个换行结尾；提交前 `git diff --cached --check`。

## 渐进式 TypeScript 迁移

当前状态：`src/tool-args.ts` 与 `src/ansi.ts` 是完整 TypeScript（strict 通过）；`src/index.js` 与 `src/client.js` 仍是带 JSDoc 的 JS，`checkJs` 未开启（历史代码无参数类型标注，开启会产生大量噪音）。迁移路径：

1. 逐个函数补 JSDoc 参数/返回类型，或直接转为 `.ts`；
2. 待 JS 文件类型覆盖率达标后开启 `checkJs: true`，再逐步收紧为 `strict`；
3. 最终目标：全部源码为严格 TypeScript，与 Harness 包一致。

## 发布与安装

- npm 发布按 `files` 白名单打包（lib、src、tests、docs、cordis.patch.yml、README.md）；安装方不需要任何构建工具。
- `install.ps1` 复制仓库（跳过 `.git` 与 `node_modules`）到 profile 共享模块根，并追加 `ext-center` 行（按 id 去重）；详见 README「安装」。