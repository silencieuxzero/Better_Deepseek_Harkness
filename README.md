# better-deepseek-harness（更好的 DeepSeek Harness）

项目名致敬Minecraft模组名（？），更好的下界/末地/进度/砧板/FPS/地牢/村庄/经验修补/F3/树叶/动物动作/PVP/HUD/生存/战斗/延迟显示/附魔/图腾/掉落物/钠视频设置按钮……

为 DeepSeek Harness Web UI 编写的插件：在「设置 → 更好的 DeepSeek Harness」中直接安装、卸载、启用/停用 **技能（Skills）** 与 **插件（Plugins）**，并把插件的自身偏好接入原生设置体系（settings.yaml 的 `ext-center` 节）。

## 功能

- **技能管理**：列出已安装技能（名称 / 描述 / 适用场景 / 路径）；支持三种安装来源：
  - 粘贴 Markdown（含 `---` frontmatter，必须有 `name` 与 `description`）
  - 从 URL 下载 Markdown 文件
  - 本机文件或目录路径（目录需含 `SKILL.md`）
  - 安装位置：`~/.dsh/skills`（技能文件系统提供方实时发现，无需重启）
- **插件管理**：列出通过本插件安装的插件（版本 / 来源 / 配置行数 / 启用状态），支持：
  - 四种来源：npm 包名（走 npm registry）、`.tgz` 包 URL（内置 tar 解包，无需外部工具）、本机目录、Git 仓库
  - 安装后写入 profile 的 `cordis.patch.yml`，由启动时的 HMR 配置监听器**热生效，无需重启**；带客户端界面的插件在刷新页面后出现
  - 启用 / 停用 / 卸载（同样热生效）
  - 只读展示当前加载器条目（id / 状态 / 是否启用）
- **设置项**（原生 settings 命名空间 `ext-center`）：
  - `allowLan`：是否允许局域网通过 `/ext/api` 写入（默认仅本机回环）
  - `skillRoot`：技能安装根目录（留空 = `~/.dsh/skills`）
  - `customSkillDirs`：额外技能目录，每行一个；其中的技能会通过本插件注册的 provider 提供给所有会话
  - `treeRoot`：侧栏文件树根目录（留空 = 最近注册的工作区，其次进程工作目录）
- **侧栏文件树**：在侧栏底部提供工作区文件浏览（`GET /ext/api/tree`），逐级展开目录，目录显示子项数、文件显示大小，每行可一键复制路径；支持全部收起与根目录配置（设置项 `treeRoot`；留空时默认最近注册的工作区，其次进程工作目录）；点击面板外部或按 Esc 自动收起；点击文件在弹窗编辑器中打开，可保存（仅限树根内既有文件，1 MiB 上限，二进制/NUL 防护）
- **多终端**：对话页顶部「对话 / 轨迹 / 终端」页签（`conversation.view` slot）新增「终端」，可自主创建 **CMD** 或 **PowerShell** 终端并多开（上限 8 个）；左侧为活动终端（输出区 + 命令输入行 + 中断按钮），右侧列出全部终端（切换 / 关闭）；终端默认在工作区（文件树根）启动，输出通过轮询增量拉取；基于 node-pty（缺失时回退普通管道），插件卸载时自动清理全部终端进程
- **Git 面板**：对话页顶部页签新增「Git」（`conversation.view` slot，`ext-center.git`），VSCode「源代码管理」风格：
  - 顶部工具条：分支下拉切换、上游/领先/落后徽章、拉取（--ff-only）/ 推送 / 刷新
  - 提交区：多行提交信息（Ctrl+Enter 提交）；按钮显示已暂存数量；无暂存或有合并冲突时禁用并提示
  - 更改分组：已暂存的更改 / 未暂存的更改 / 未跟踪的文件，含 VSCode 配色状态徽章（M/A/D/R/冲突/未跟踪）、重命名来源、行内「+ / − / ✕」（暂存 / 取消暂存 / 放弃更改，放弃需确认）；组头「全部暂存 / 全部取消暂存」
  - 差异视图：点击文件查看统一 diff（行号 + 增删/上下文/块头着色）；未跟踪文件以全新增形式展示；二进制文件与超大差异有提示；合并冲突以合并 diff 原样展示
  - 提交历史：最近 30 条（短哈希 / 作者 / 时间 / 主题）
  - 状态每 5 秒自动刷新；仓库自动从文件树根向上查找 .git；所有操作由主机侧 git 子进程执行（GIT_TERMINAL_PROMPT=0，防挂起）
- **工具参数自动修复**：通过 `tools/execute` 包装层修复模型偶发的参数抖动——`description` 缺失 / 为空 / 类型错误时自动补上中性占位符；`arguments` 是损坏 JSON（截断、夹杂文字、尾逗号）时尝试恢复为对象，避免无谓的 `INVALID_ARGS` 报错

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

## 使用

1. 打开 Web UI → 设置（齿轮）→ **更好的 DeepSeek Harness**
2. 「技能」页：填写名称（小写 kebab-case）与内容 / URL / 路径，点安装；列表项可卸载
3. 「插件」页：选择来源并填写 npm 包名 / tarball URL / 本机目录 / Git 仓库地址，点安装；已安装插件可启用、停用、卸载
4. 「设置」页：修改本插件的偏好（保存到 settings.yaml 的 `ext-center` 节）

> 安全：所有变更类接口默认只允许本机（回环地址）调用；如需局域网管理，在「设置」页打开 `allowLan`。

## HTTP API（主机侧，前缀 /ext/api）

| 端点 | 说明 |
| --- | --- |
| `GET /ext/api/state` | 全量状态：技能列表、插件安装记录、加载器条目、配置 |
| `GET /ext/api/tree?path=...` | 文件树：列出根目录下的一级条目（含 type / size / mtime / children 计数与 truncated 截断标记）；根目录解析：`treeRoot` 设置 → 最近注册的工作区 → 进程工作目录；相对路径可选 |
| `GET /ext/api/tree/content?path=...` | 读取树根内一个文本文件（拒绝目录 / 超大 / 含 NUL 的二进制），供编辑器打开 |
| `POST /ext/api/tree/write` | `{path, content}` 原子写回树根内既有文件（临时文件 + rename；同样有大小与二进制防护） |
| `GET /ext/api/terminal/list` | 全部终端会话（id / kind / cwd / alive / exitCode / createdAt） |
| `POST /ext/api/terminal/create` | `{kind:'cmd'\|'powershell'}` 新建终端（上限 8 个；cwd = 文件树根）；返回 `{id, kind, cwd}` |
| `POST /ext/api/terminal/write` | `{id, data}` 向终端写入输入（单次 ≤ 4096 字符；已退出终端拒绝） |
| `POST /ext/api/terminal/resize` | `{id, cols, rows}` 调整终端尺寸（pty 模式生效） |
| `POST /ext/api/terminal/kill` | `{id}` 关闭终端（幂等） |
| `GET /ext/api/terminal/output?id=..&after=..` | 轮询增量输出：`after` 为客户端已读长度，返回 `{alive, exitCode, text}` |
| `GET /ext/api/git/status` | Git 状态：仓库根、分支、上游、领先/落后、更改列表（含 staged/unstaged/untracked/重命名/冲突标记） |
| `GET /ext/api/git/diff?path=..&staged=0|1` | 单文件 diff（结构化为 meta/hunk/ctx/add/del 行，带双侧行号；未跟踪文件按全新增合成；合并冲突按 combined 原样返回） |
| `GET /ext/api/git/log?n=30` | 最近提交（oid/short/author/time/subject） |
| `GET /ext/api/git/branches` | 分支列表（含 current 标记） |
| `POST /ext/api/git/stage` | `{paths:[...]}` 暂存（git add） |
| `POST /ext/api/git/stage-all` | 全部暂存（git add -A） |
| `POST /ext/api/git/unstage` | `{paths:[...]}` 取消暂存（git restore --staged） |
| `POST /ext/api/git/unstage-all` | 全部取消暂存（git reset） |
| `POST /ext/api/git/commit` | `{message}` 提交（git commit -m） |
| `POST /ext/api/git/discard` | `{paths:[...]}` 放弃更改（git checkout --；未跟踪文件直接删除，拒绝目录） |
| `POST /ext/api/git/checkout` | `{branch}` 切换分支（名称白名单校验） |
| `POST /ext/api/git/pull` | 拉取（--ff-only，60 秒超时） |
| `POST /ext/api/git/push` | 推送（60 秒超时） |
| `POST /ext/api/config` | 写 `ext-center` 设置命名空间（`allowLan` / `skillRoot` / `customSkillDirs` / `treeRoot`） |
| `POST /ext/api/skill/install` | `{name, text?\|url?\|path?}` 安装技能 |
| `POST /ext/api/skill/uninstall` | `{name}` 卸载技能 |
| `POST /ext/api/plugin/install` | `{source:{kind:'npm'\|'url'\|'folder'\|'git', spec?\|url?\|path?}}` 安装插件 |
| `POST /ext/api/plugin/uninstall` | `{name}` 卸载插件（移除补丁行 + 包目录） |
| `POST /ext/api/plugin/set-enabled` | `{name, enabled}` 启用 / 停用插件 |

响应统一为 `{ok:true,value}` 或 `{ok:false,error:{code,message}}`。

## 实现要点

- 插件安装 = 包落到 `~/.dsh/profiles/node_modules`（profile 解析链上的共享根）→ 把该包在 package.json 的 `dsh.bundle.patch` 中声明的补丁文件的行（若有）合并进 profile 的 `cordis.patch.yml`；没有 bundle 补丁的包自动补一条 `{id: <包名>, name: <包名>}` 行，保证它能被加载 → HMR 配置监听器事务性重放补丁，条目即时挂载
- 所有 `cordis.patch.yml` 写入都是「解析 → 合并 → 临时文件 + rename 原子写」，保留文件头注释；`!!js` 表达式（loader 配置方言）往返无损；连续写入之间有间隔（串行化），避免监听器背靠背刷新
- 包来源与补丁行记录在 profile 目录的 `.dsh-ext-center.json`（卸载 / 停用时据此精确移除对应行）
- 技能/插件列表与加载器状态由 `GET /ext/api/state` 提供；客户端通过 `fetch` 调用
- 本插件自身的偏好走原生 `ctx.settings` 命名空间（`ext-center`），浏览器侧用 `settingsScope` 读写
- 通过 `tools/execute` waterfall（与 `dsh-tool-call-timeout-policy` 同机制）在参数校验前修复模型生成的工具参数；只修安全的 `description` 与可恢复的 JSON 字符串，绝不伪造 `code` / `command` 等内容字段
- 文件树根目录解析：`treeRoot` 设置 → `ctx.workspaceRegistry` 最近注册的工作区 → 进程 `cwd`；因此未配置时默认展示最近使用的工作区

## 目录结构

```
better-deepseek-harness/
├── package.json          # dsh.bundle.patch + dsh.client(platform: web) 声明
├── cordis.patch.yml      # bundle 补丁：插入 ext-center 行
├── install.ps1           # 一键安装脚本（方式一）
├── lib/
│   ├── index.js          # 主机侧：settings 命名空间、/ext/api 路由、技能/插件生命周期、文件树读写、工具参数修复
│   ├── tool-args.js      # 模型工具参数修复纯函数（tools/execute 包装层使用）
│   └── client.js         # 浏览器侧：设置页「更好的 DeepSeek Harness」区块（__ModuleLoader__ 工厂格式）
└── README.md
```

## 故障排查

- **改动未热生效**：`cordis.patch.yml` 的变更由 harness 的配置监听器（HMR）应用。若短时间内连续多次修改（例如安装后立刻停用）触发监听器竞态，配置监听可能卡住——重启一次 `dsh web` 即可恢复（补丁文件本身是正确的，重启后照常加载）。本插件的写入已做间隔串行化以尽量避免该情况。
- **看不到设置页区块**：浏览器刷新页面（客户端 bundle 由 boot manifest 注入，刷新后加载）。
- **安装报 git-unavailable**：本机未安装 git，改用目录 / tarball URL / npm 包名来源。
- **偶发 `invalid arguments: missing required property ...`**：模型生成的工具参数偶发缺字段或 JSON 损坏。本插件的 `tools/execute` 包装层会自动修复 `description` 缺失与可恢复的 JSON；确实缺少 `code` / `command` 等内容的调用仍会按 DSH 原机制报错并让模型重试，属正常反馈。
