# AGENTS.md

better-deepseek-harness 是一个独立的 DeepSeek Harness 插件仓库（不是 Harness monorepo 的一部分）：宿主侧 + 浏览器侧 + 纯逻辑三个模块。改动代码前读 [docs/architecture.md](docs/architecture.md)；开发流程与目录约定见 [docs/development.md](docs/development.md)。

## 仓库布局

```
src/       源码：index.js（宿主侧）、client.js（浏览器侧）、tool-args.ts / ansi.ts / tavily.ts / terminal-buffer.ts / rescue.ts（纯逻辑 TS）
tests/     vitest 规格（*.spec.ts）
docs/      架构与开发文档
lib/       构建产物（npm run build 生成；不提交进 git，安装/测试时自动构建）
cordis.patch.yml   bundle 补丁（插入 ext-center 行）
install.ps1        一键安装脚本（复制后自动 npm ci + 构建 lib/）
package.json       main/exports 指向 lib/；dsh.bundle.patch + dsh.client 声明；prepare 自动构建
```

## 命令

```sh
npm install          # 安装依赖并触发 prepare（自动构建 lib/）
npm run typecheck    # tsc --noEmit（strict；覆盖 src 与 tests）
npm test             # pretest 自动构建后运行 vitest 单测
npm run build        # tsc 发射 src/ → lib/
npm run check        # typecheck + test
```

`lib/` 是生成产物、不提交进 git。改完 `src/` 后本地 `npm run build`（或 `npm test` / `npm install` 自动构建）验证；安装流程会在目标目录构建，不再依赖提交的 `lib/`。

## 约定

- ESM 全局（`"type": "module"`）；相对导入带 `.js` 后缀（NodeNext 解析）。
- 注册即效应：一切注册走 `ctx.effect` / `ctx.on`，disposer 挂进效应，插件卸载时一并释放。
- 部署可调项是 `ConfigSchema`（schemastery）字段，每个字段自带默认值与合法范围，非法值响亮失败；安全不变量（请求体/文件/终端写入/git 路径上限）保持固定常量、不可配置。
- 显式优先：默认值在实现里显式解析，不在 `run()` 里藏 `?? default`。
- 新行为挂在文档化扩展点（settings / webServer / skills / tools/execute / llm/stream 瀑布），不改 agent-loop。
- 测试描述行为而非正确性：行为变了就同步改测试并解释原因；纯函数进 `tool-args.ts`（或新的纯模块），有 I/O 的逻辑用 ctx 双在 `tests/host-wiring.spec.ts` 覆盖。
- TODO 标记：`FIXME`（阻塞发布）/ `TODO`（尽快修）/ `XXX`（有生之年）。
- 文件以单个换行结尾；提交前 `git diff --cached --check`。
- 文档随代码走：行为变化同步更新 docs/architecture.md 与 README。

## 渐进式 TypeScript

`src/tool-args.ts`、`src/ansi.ts`、`src/tavily.ts`、`src/terminal-buffer.ts` 与 `src/rescue.ts` 是完整 TypeScript（strict 通过）；`src/index.js` 与 `src/client.js` 是带 JSDoc 的 JS，`checkJs` 未开启。新增代码写 `.ts`；存量迁移路径见 docs/development.md。
