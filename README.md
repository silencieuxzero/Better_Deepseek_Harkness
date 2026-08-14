# better-deepseek-harness（更好的 DeepSeek Harness）

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
- **侧栏文件树**：在侧栏底部提供工作区文件浏览（`GET /ext/api/tree`），逐级展开目录并复制路径，便于在「插件」页选择本机目录来源

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
| `GET /ext/api/tree?path=...` | 文件树：列出根目录（默认工作目录）下的一级条目，供侧栏文件树浏览；相对路径可选 |
| `POST /ext/api/config` | 写 `ext-center` 设置命名空间（`allowLan` / `skillRoot` / `customSkillDirs`） |
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

## 目录结构

```
better-deepseek-harness/
├── package.json          # dsh.bundle.patch + dsh.client(platform: web) 声明
├── cordis.patch.yml      # bundle 补丁：插入 ext-center 行
├── install.ps1           # 一键安装脚本（方式一）
├── lib/
│   ├── index.js          # 主机侧：settings 命名空间、/ext/api 路由、技能/插件生命周期
│   └── client.js         # 浏览器侧：设置页「更好的 DeepSeek Harness」区块（__ModuleLoader__ 工厂格式）
└── README.md
```

## 故障排查

- **改动未热生效**：`cordis.patch.yml` 的变更由 harness 的配置监听器（HMR）应用。若短时间内连续多次修改（例如安装后立刻停用）触发监听器竞态，配置监听可能卡住——重启一次 `dsh web` 即可恢复（补丁文件本身是正确的，重启后照常加载）。本插件的写入已做间隔串行化以尽量避免该情况。
- **看不到设置页区块**：浏览器刷新页面（客户端 bundle 由 boot manifest 注入，刷新后加载）。
- **安装报 git-unavailable**：本机未安装 git，改用目录 / tarball URL / npm 包名来源。
