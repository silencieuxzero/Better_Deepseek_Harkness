window.__ModuleLoader__.load({
	id: "better-deepseek-harness",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var _react = require("react");
		var _jsx_runtime = require("react/jsx-runtime");
		var _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var useState = _react.useState, useEffect = _react.useEffect, useCallback = _react.useCallback, useMemo = _react.useMemo, useRef = _react.useRef, useSyncExternalStore = _react.useSyncExternalStore;
		var jsx = _jsx_runtime.jsx, jsxs = _jsx_runtime.jsxs, Fragment = _jsx_runtime.Fragment;
		//#region styles
		(function installStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("ext-center-styles")) return;
			var style = document.createElement("style");
			style.id = "ext-center-styles";
			style.setAttribute("data-plugin", "better-deepseek-harness");
			style.textContent = ".extc{display:flex;flex-direction:column;gap:14px;padding:2px 0 10px}\n.extc-panel{display:flex;flex-direction:column;gap:16px}\n.extc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:nowrap}\n.extc-header-main{flex:1;min-width:0}\n.extc-title{margin:0 0 4px;font-size:1.15rem;font-weight:600}\n.extc-intro{margin:0;font-size:.85rem;opacity:.75;line-height:1.5;max-width:72ch}\n.extc-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(128,128,128,.35)}\n.extc-tab{appearance:none;background:transparent;border:none;padding:8px 14px;cursor:pointer;font-size:.9rem;color:inherit;opacity:.7;border-bottom:2px solid transparent;white-space:nowrap;writing-mode:horizontal-tb}\n.extc-tab:hover{opacity:1}\n.extc-tab-active{opacity:1;border-bottom-color:currentColor;font-weight:600}\n.extc-card{border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:14px 16px;background:rgba(128,128,128,.05);display:flex;flex-direction:column;gap:12px}\n.extc-card-title{margin:0 0 4px;font-size:.95rem;font-weight:600}\n.extc-empty{margin:0;font-size:.85rem;opacity:.7;line-height:1.5}\n.extc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}\n.extc-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(128,128,128,.22);border-radius:6px;background:rgba(128,128,128,.04)}\n.extc-row-flat{border-style:dashed}\n.extc-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n.extc-row-title{font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.extc-row-sub{font-size:.8rem;opacity:.75;line-height:1.4}\n.extc-row-meta{font-size:.75rem;opacity:.55;font-family:ui-monospace,Consolas,monospace;word-break:break-all}\n.extc-tag{font-size:.65rem;padding:1px 6px;border-radius:99px;border:1px solid rgba(128,128,128,.4);opacity:.8}\n.extc-form{display:flex;flex-direction:column;gap:20px}\n.extc-field{display:flex;flex-direction:column;gap:7px}\n.extc-field-label{font-size:.82rem;font-weight:500;display:flex;flex-direction:column;gap:2px}\n.extc-field-hint{font-size:.72rem;opacity:.6;font-weight:400}\n.extc-input{font:inherit;font-size:.85rem;padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;width:100%;box-sizing:border-box}\n.extc-textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:.8rem}\n.extc-check{display:flex;align-items:center;gap:8px;font-size:.85rem}\n.extc-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.extc-btn{font:inherit;font-size:.82rem;padding:6px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;cursor:pointer;white-space:nowrap;flex:none;writing-mode:horizontal-tb}\n.extc-btn:hover{background:rgba(128,128,128,.12)}\n.extc-btn:disabled{opacity:.45;cursor:default}\n.extc-btn-primary{background:rgba(64,128,255,.16);border-color:rgba(64,128,255,.5);font-weight:600}\n.extc-btn-danger{border-color:rgba(255,80,80,.5);color:#e05c5c}\n.extc-btn-small{padding:3px 8px;font-size:.75rem}\n.extc-status{display:flex;flex-direction:column;gap:4px;font-size:.82rem}\n.extc-error{color:#e05c5c;font-size:.82rem;margin:0;line-height:1.4}\n.extc-ok{color:#3fae6a;font-size:.82rem;margin:0;line-height:1.4}\n.extc-tlayer{flex:none;position:relative;width:100%;height:49px;margin:8px 0 0;display:flex;align-items:center}\n.extc-trigger{width:100%;height:49px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;opacity:.85}\n.extc-trigger:hover,.extc-trigger-open{background:rgba(128,128,128,.12);opacity:1}\n.extc-trigger-rail{width:36px;height:36px;border-radius:50%;justify-content:center;gap:0;padding:0}\n.extc-trigger-label{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tpanel{z-index:30;border:1px solid rgba(128,128,128,.3);background:var(--dsw-alias-bg-base,rgba(24,24,27,.98));width:380px;max-width:calc(100vw - 24px);max-height:60vh;border-radius:12px;flex-direction:column;display:flex;position:fixed;bottom:128px;left:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}\n.extc-theader{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.25)}\n.extc-ttitle{font-size:13px;font-weight:500;line-height:20px;min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-ticon{width:28px;height:28px;border:none;background:0 0;border-radius:50%;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:.8}\n.extc-ticon:hover{background:rgba(128,128,128,.15)}\n.extc-tbody{flex:1;min-height:0;padding:6px 8px 10px;overflow-y:auto;overscroll-behavior:contain}\n.extc-tlist{margin:0;padding:0;list-style:none}\n.extc-tnode{margin:0;padding:0}\n.extc-trow{width:100%;border:none;background:0 0;color:inherit;font-family:inherit;font-size:13px;line-height:24px;display:flex;align-items:center;gap:4px;cursor:pointer;border-radius:6px;text-align:left;padding-right:8px}\n.extc-trow:hover{background:rgba(128,128,128,.1)}\n.extc-tcaret{flex:none;opacity:.6;transition:transform .12s ease}\n.extc-tcaret-open{transform:rotate(90deg)}\n.extc-tname{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tdot{flex:none;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.45;margin:0 5px}\n.extc-tmeta{margin-left:auto;flex:none;font-size:11px;opacity:.55;padding-left:8px}\n.extc-tcopied{opacity:.9}\n.extc-tempty{font-size:12px;opacity:.6;padding:2px 0 2px 26px;line-height:20px}\n.extc-terr{font-size:12px;line-height:18px;color:#e05c5c;padding:4px 8px}\n.extc-tnote{font-size:12px;opacity:.6;padding:6px 8px;margin:0;line-height:18px}\n.extc-tretry{margin-left:8px;border:none;background:0 0;color:inherit;cursor:pointer;text-decoration:underline;font-size:12px;padding:0}\n.extc-tnode{position:relative;display:flex;flex-wrap:wrap;align-items:center}\n.extc-trow{flex:1;width:auto;min-width:0}\n.extc-theader-actions{display:flex;align-items:center;gap:2px}\n.extc-ticon:disabled{opacity:.35;cursor:default}\n.extc-tkids{width:100%}\n.extc-tcopy{flex:none;width:22px;height:22px;border:none;background:0 0;border-radius:4px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .1s ease}\n.extc-tnode:hover .extc-tcopy,.extc-tcopy:focus-visible{opacity:.75}\n.extc-tcopy:hover{opacity:1;background:rgba(128,128,128,.15)}\n.extc-editor{display:flex;flex-direction:column;gap:8px;min-width:420px;max-width:80vw}\n.extc-editor .extc-textarea{min-height:280px;width:100%;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:.8rem;line-height:1.5;resize:vertical}";
			document.head.appendChild(style);
		})();
		//#endregion
		//#region lib/types/client/locales.js
		/** Simplified Chinese dictionary (key source of truth). */
		var zh = {
			nav: "更好的 DeepSeek Harness",
			title: "更好的 DeepSeek Harness",
			intro: "从 Web UI 安装和管理技能（Skills）与插件（Plugins）。安装的插件通过 cordis.patch.yml 热生效，无需重启；带界面的插件在刷新页面后出现。",
			close: "关闭",
			tabSkills: "技能",
			tabPlugins: "插件",
			tabSettings: "设置",
			loading: "正在读取…",
			error: "读取失败：",
			retry: "重试",
			emptySkills: "还没有安装任何技能。技能存放在 ~/.dsh/skills（每个技能一个 .md 文件或目录）。",
			emptyPlugins: "还没有通过扩展中心安装任何插件。",
			skillName: "技能名称",
			skillNameHint: "小写 kebab-case，例如 code-review",
			skillSource: "来源",
			skillModeText: "粘贴 Markdown",
			skillModeUrl: "从 URL 下载",
			skillModePath: "本机路径",
			skillText: "技能内容（含 --- frontmatter ---，必须有 name 与 description）",
			skillUrl: "Markdown 文件 URL",
			skillPath: "本机文件或目录路径（目录需含 SKILL.md）",
			install: "安装",
			installing: "安装中…",
			uninstall: "卸载",
			uninstallConfirm: "确定卸载技能 ",
			uninstallAsk: "？",
			installedAt: "路径",
			whenToUse: "适用场景",
			skillInstallOk: "技能已安装：",
			skillRemoveOk: "技能已卸载：",
			pluginInstallTitle: "安装插件",
			pluginSource: "来源类型",
			pluginModeNpm: "npm 包名",
			pluginModeUrl: "tgz 包 URL",
			pluginModeFolder: "本机目录",
			pluginModeGit: "Git 仓库",
			pluginSpec: "包名（可带版本，如 my-plugin@1.2.0）",
			pluginUrl: "npm pack 产物 (.tgz) 的 URL",
			pluginFolder: "包含 package.json 的目录路径",
			pluginGit: "Git 仓库 URL",
			pluginNameOptional: "安装后将按 package.json 中的 name 为准",
			pluginInstallOk: "插件已安装：",
			pluginInstallNote: "主机侧已热生效；客户端界面刷新页面后出现。",
			pluginRemoveOk: "插件已卸载：",
			pluginRemoveConfirm: "确定卸载插件 ",
			pluginToggleOk: "已",
			pluginEnabled: "已启用",
			pluginDisabled: "已停用",
			enable: "启用",
			disable: "停用",
			version: "版本",
			builtin: "内置",
			rows: "配置行",
			source: "来源",
			pluginListTitle: "已安装插件",
			loaderTitle: "加载器条目（只读）",
			phaseActive: "运行中",
			phaseFailed: "失败",
			phasePending: "等待依赖",
			phaseLoading: "加载中",
			phaseUnloading: "卸载中",
			phaseUnknown: "未知",
			settingsTitle: "扩展中心设置",
			settingsIntro: "这些设置写入本部署的设置文档（settings.yaml 的 ext-center 节）。",
			allowLan: "允许局域网写入",
			allowLanHint: "开启后，局域网内的浏览器也能通过 /ext/api 安装、卸载或停用插件与技能。默认仅限本机（回环地址）。",
			skillRoot: "技能根目录",
			skillRootHint: "安装技能的目标目录；留空使用 ~/.dsh/skills。",
			customSkillDirs: "额外技能目录",
			customSkillDirsHint: "每行一个目录；这些目录中的技能会提供给所有会话。",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			reset: "重置",
			readOnly: "本部署的设置只读。",
			notWritable: "设置不可写",
			busy: "处理中…",
			noop: "没有变化。",
			confirmToggle: "确定",
			cancel: "取消",
			treeTrigger: "文件树",
			treeTriggerAria: "打开文件树",
			treePanelTitle: "文件树",
			treeRefresh: "刷新",
			treeLoading: "加载中…",
			treeEmpty: "（空目录）",
			treeError: "读取失败：",
			treeRetry: "重试",
			treeCopied: "已复制路径",
			treeRoot: "文件树根目录",
			treeRootHint: "侧栏文件树浏览的根目录；留空使用最近的工作区（其次进程工作目录）。",
			treeCollapseAll: "全部收起",
			treeTruncated: "（仅显示前 2000 项）",
			treeCopyPath: "复制路径"
		};
		/** English dictionary checked against the Chinese key set. */
		var en = {
			nav: "Better DeepSeek Harness",
			title: "Better DeepSeek Harness",
			intro: "Install and manage skills and plugins from the Web UI. Installed plugins take effect live through cordis.patch.yml — no restart needed; a plugin's own UI appears after a page refresh.",
			close: "Close",
			tabSkills: "Skills",
			tabPlugins: "Plugins",
			tabSettings: "Settings",
			loading: "Loading…",
			error: "Failed to load: ",
			retry: "Retry",
			emptySkills: "No skills installed yet. Skills live in ~/.dsh/skills (one .md file or directory per skill).",
			emptyPlugins: "No plugins installed through the extension center yet.",
			skillName: "Skill name",
			skillNameHint: "Lowercase kebab-case, e.g. code-review",
			skillSource: "Source",
			skillModeText: "Paste Markdown",
			skillModeUrl: "Download from URL",
			skillModePath: "Local path",
			skillText: "Skill content (with --- frontmatter ---; name and description required)",
			skillUrl: "Markdown file URL",
			skillPath: "Local file or folder path (folder must contain SKILL.md)",
			install: "Install",
			installing: "Installing…",
			uninstall: "Uninstall",
			uninstallConfirm: "Uninstall skill ",
			uninstallAsk: "?",
			installedAt: "Path",
			whenToUse: "When to use",
			skillInstallOk: "Skill installed: ",
			skillRemoveOk: "Skill removed: ",
			pluginInstallTitle: "Install a plugin",
			pluginSource: "Source type",
			pluginModeNpm: "npm package name",
			pluginModeUrl: "Tarball (.tgz) URL",
			pluginModeFolder: "Local folder",
			pluginModeGit: "Git repository",
			pluginSpec: "Package name (optionally with a version, e.g. my-plugin@1.2.0)",
			pluginUrl: "URL of an npm pack artifact (.tgz)",
			pluginFolder: "Folder path containing package.json",
			pluginGit: "Git repository URL",
			pluginNameOptional: "The package.json name wins after install",
			pluginInstallOk: "Plugin installed: ",
			pluginInstallNote: "Host rows activated live; a client UI appears after a page refresh.",
			pluginRemoveOk: "Plugin removed: ",
			pluginRemoveConfirm: "Uninstall plugin ",
			pluginToggleOk: "Now ",
			pluginEnabled: "Enabled",
			pluginDisabled: "Disabled",
			enable: "Enable",
			disable: "Disable",
			version: "Version",
			builtin: "Built-in",
			rows: "Config rows",
			source: "Source",
			pluginListTitle: "Installed plugins",
			loaderTitle: "Loader entries (read-only)",
			phaseActive: "Active",
			phaseFailed: "Failed",
			phasePending: "Pending",
			phaseLoading: "Loading",
			phaseUnloading: "Unloading",
			phaseUnknown: "Unknown",
			settingsTitle: "Extension Center settings",
			settingsIntro: "These preferences are stored in this deployment's settings document (the ext-center section of settings.yaml).",
			allowLan: "Allow LAN writes",
			allowLanHint: "When enabled, browsers on the LAN can also install, uninstall, or disable skills and plugins through /ext/api. Off by default: loopback only.",
			skillRoot: "Skill root",
			skillRootHint: "Where new skills are installed; leave empty for ~/.dsh/skills.",
			customSkillDirs: "Extra skill directories",
			customSkillDirsHint: "One directory per line; skills in these directories are offered to every session.",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			reset: "Reset",
			readOnly: "This deployment stores settings read-only.",
			notWritable: "Settings are not writable",
			busy: "Working…",
			noop: "Nothing to change.",
			confirmToggle: "OK",
			cancel: "Cancel",
			treeTrigger: "Files",
			treeTriggerAria: "Open file tree",
			treePanelTitle: "File tree",
			treeRefresh: "Refresh",
			treeLoading: "Loading…",
			treeEmpty: "(empty)",
			treeError: "Failed to load: ",
			treeRetry: "Retry",
			treeCopied: "Path copied",
			treeRoot: "File tree root",
			treeRootHint: "Root directory browsed by the sidebar file tree; leave empty for the most recent workspace (fallback: process cwd).",
			treeCollapseAll: "Collapse all",
			treeTruncated: "(showing first 2,000 entries)",
			treeCopyPath: "Copy path"
		};
		//#endregion
		//#region lib/types/client/api.js
		async function callApi(path, body) {
			var response = await fetch(path, {
				method: body === void 0 ? "GET" : "POST",
				headers: body === void 0 ? void 0 : { "content-type": "application/json" },
				body: body === void 0 ? void 0 : JSON.stringify(body),
				cache: "no-store"
			});
			var json = await response.json().catch(function () {
				return { ok: false, error: { code: "bad-response", message: "HTTP " + response.status } };
			});
			if (!json.ok) throw new Error(json.error && json.error.message ? json.error.message : "request failed");
			return json.value;
		}
		//#endregion
		//#region lib/types/client/components.js
		/** Shared building blocks for the section. */
		function Button(props) {
			return jsx("button", Object.assign({
				type: "button",
				className: "extc-btn" + (props.primary ? " extc-btn-primary" : "") + (props.danger ? " extc-btn-danger" : "") + (props.small ? " extc-btn-small" : "") + (props.disabled ? " extc-btn-disabled" : "")
			}, {
				disabled: props.disabled || props.busy,
				onClick: props.onClick
			}, props.children !== void 0 ? { children: props.busy ? props.busyLabel || "…" : props.children } : {}));
		}
		function Field(props) {
			return jsxs("label", {
				className: "extc-field",
				children: [
					jsxs("span", { className: "extc-field-label", children: [props.label, props.hint ? jsx("span", { className: "extc-field-hint", children: props.hint }) : null] }),
					props.children
				]
			});
		}
		function TextInput(props) {
			return jsx("input", {
				type: "text",
				className: "extc-input",
				value: props.value,
				placeholder: props.placeholder,
				disabled: props.disabled,
				onChange: function (event) { props.onChange(event.target.value); }
			});
		}
		function TextArea(props) {
			return jsx("textarea", {
				className: "extc-input extc-textarea",
				rows: props.rows || 5,
				value: props.value,
				placeholder: props.placeholder,
				disabled: props.disabled,
				onChange: function (event) { props.onChange(event.target.value); }
			});
		}
		function Select(props) {
			return jsx("select", {
				className: "extc-input",
				value: props.value,
				disabled: props.disabled,
				onChange: function (event) { props.onChange(event.target.value); },
				children: props.options.map(function (option) {
					return jsx("option", { value: option.value, children: option.label }, option.value);
				})
			});
		}
		function Notice(props) {
			if (!props.children) return null;
			return jsx("div", { className: "extc-notice extc-notice-" + props.kind, children: props.children });
		}
		function StatusLine(props) {
			if (!props.error && !props.message) return null;
			return jsx("div", {
				className: "extc-status",
				children: [
					props.error ? jsx("span", { className: "extc-error", children: props.error }) : null,
					props.message ? jsx("span", { className: "extc-ok", children: props.message }) : null
				]
			});
		}
		function phaseLabel(t, phase) {
			switch (phase) {
				case "active": return t("phaseActive");
				case "failed": return t("phaseFailed");
				case "pending": return t("phasePending");
				case "loading": return t("phaseLoading");
				case "unloading": return t("phaseUnloading");
				default: return t("phaseUnknown");
			}
		}
		//#endregion
		//#region lib/types/client/SkillsTab.js
		/** The Skills tab: list installed skills and install/uninstall them. */
		function SkillsTab(props) {
			var t = props.t;
			var loadState = props.loadState;
			var _a = useState(null), state = _a[0], setState = _a[1];
			var _b = useState(null), error = _b[0], setError = _b[1];
			var _c = useState(""), name = _c[0], setName = _c[1];
			var _d = useState("text"), mode = _d[0], setMode = _d[1];
			var _e = useState(""), text = _e[0], setText = _e[1];
			var _f = useState(""), url = _f[0], setUrl = _f[1];
			var _g = useState(""), path = _g[0], setPath = _g[1];
			var _h = useState(false), busy = _h[0], setBusy = _h[1];
			var _i = useState(null), message = _i[0], setMessage = _i[1];
			var load = useCallback(function () {
				loadState().then(function (value) {
					setState(value);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [loadState]);
			useEffect(function () { load(); }, [load]);
			var install = useCallback(function () {
				if (!name.trim()) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				var payload = { name: name.trim() };
				if (mode === "text") payload.text = text;
				else if (mode === "url") payload.url = url.trim();
				else payload.path = path.trim();
				callApi("/ext/api/skill/install", payload).then(function () {
					setName("");
					setText("");
					setUrl("");
					setPath("");
					setMessage(t("skillInstallOk") + name.trim());
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [name, mode, text, url, path, t, load]);
			var remove = useCallback(function (skillName) {
				if (!window.confirm(t("uninstallConfirm") + skillName + t("uninstallAsk"))) return;
				setBusy(true);
				callApi("/ext/api/skill/uninstall", { name: skillName }).then(function () {
					setMessage(t("skillRemoveOk") + skillName);
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [t, load]);
			var skills = state && state.skills ? state.skills : [];
			return jsxs("div", { className: "extc-panel", children: [
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("tabSkills") }),
					skills.length === 0 ? jsx("p", { className: "extc-empty", children: t("emptySkills") }) : jsx("ul", { className: "extc-list", children: skills.map(function (skill) {
						return jsxs("li", { className: "extc-row", children: [
							jsxs("div", { className: "extc-row-main", children: [
								jsx("span", { className: "extc-row-title", children: skill.name }),
								jsx("span", { className: "extc-row-sub", children: skill.description }),
								skill.whenToUse ? jsx("span", { className: "extc-row-sub", children: t("whenToUse") + ": " + skill.whenToUse }) : null,
								jsx("span", { className: "extc-row-meta", children: t("installedAt") + ": " + skill.path })
							] }),
							jsx(Button, { small: true, danger: true, busy: busy, onClick: function () { remove(skill.name); }, children: t("uninstall") })
						] }, skill.name);
					}) }),
					jsx(StatusLine, { error: error, message: message })
				] }),
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("install") }),
					jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("skillName"), hint: t("skillNameHint"), children: jsx(TextInput, { value: name, disabled: busy, onChange: setName }) }),
						jsx(Field, { label: t("skillSource"), children: jsx(Select, { value: mode, disabled: busy, onChange: setMode, options: [
							{ value: "text", label: t("skillModeText") },
							{ value: "url", label: t("skillModeUrl") },
							{ value: "path", label: t("skillModePath") }
						] }) }),
						mode === "text" ? jsx(Field, { label: t("skillText"), children: jsx(TextArea, { value: text, disabled: busy, onChange: setText, rows: 8 }) }) : null,
						mode === "url" ? jsx(Field, { label: t("skillUrl"), children: jsx(TextInput, { value: url, disabled: busy, onChange: setUrl }) }) : null,
						mode === "path" ? jsx(Field, { label: t("skillPath"), children: jsx(TextInput, { value: path, disabled: busy, onChange: setPath }) }) : null,
						jsx(Button, { primary: true, busy: busy, disabled: !name.trim(), onClick: install, children: t("install") })
					] })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/PluginsTab.js
		/** The Plugins tab: managed installs, loader inventory, install form. */
		function PluginsTab(props) {
			var t = props.t;
			var loadState = props.loadState;
			var _a = useState(null), state = _a[0], setState = _a[1];
			var _b = useState(null), error = _b[0], setError = _b[1];
			var _c = useState("npm"), mode = _c[0], setMode = _c[1];
			var _d = useState(""), spec = _d[0], setSpec = _d[1];
			var _e = useState(""), url = _e[0], setUrl = _e[1];
			var _f = useState(""), folder = _f[0], setFolder = _f[1];
			var _g = useState(""), git = _g[0], setGit = _g[1];
			var _h = useState(false), busy = _h[0], setBusy = _h[1];
			var _i = useState(null), message = _i[0], setMessage = _i[1];
			var load = useCallback(function () {
				loadState().then(function (value) {
					setState(value);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [loadState]);
			useEffect(function () { load(); }, [load]);
			var install = useCallback(function () {
				setBusy(true);
				setError(null);
				setMessage(null);
				var source = { kind: mode };
				if (mode === "npm") source.spec = spec.trim();
				else if (mode === "url") source.url = url.trim();
				else if (mode === "folder") source.path = folder.trim();
				else source.url = git.trim();
				callApi("/ext/api/plugin/install", { source: source }).then(function (value) {
					setSpec("");
					setUrl("");
					setFolder("");
					setGit("");
					setMessage(t("pluginInstallOk") + value.name + " (" + (value.version || "?") + ") — " + t("pluginInstallNote"));
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [mode, spec, url, folder, git, t, load]);
			var toggle = useCallback(function (pluginName, enabled) {
				setBusy(true);
				callApi("/ext/api/plugin/set-enabled", { name: pluginName, enabled: enabled }).then(function () {
					setMessage(t("pluginToggleOk") + (enabled ? t("pluginEnabled") : t("pluginDisabled")) + ": " + pluginName);
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [t, load]);
			var remove = useCallback(function (pluginName) {
				if (!window.confirm(t("pluginRemoveConfirm") + pluginName + t("uninstallAsk"))) return;
				setBusy(true);
				callApi("/ext/api/plugin/uninstall", { name: pluginName }).then(function () {
					setMessage(t("pluginRemoveOk") + pluginName);
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [t, load]);
			var plugins = state && state.plugins ? state.plugins : { entries: [], installed: [] };
			var installed = plugins.installed || [];
			var entries = plugins.entries || [];
			return jsxs("div", { className: "extc-panel", children: [
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("pluginListTitle") }),
					installed.length === 0 ? jsx("p", { className: "extc-empty", children: t("emptyPlugins") }) : jsx("ul", { className: "extc-list", children: installed.map(function (plugin) {
						return jsxs("li", { className: "extc-row", children: [
							jsxs("div", { className: "extc-row-main", children: [
								jsxs("span", { className: "extc-row-title", children: [plugin.name, plugin.builtin ? jsx("span", { className: "extc-tag", children: t("builtin") }) : null] }),
								jsxs("span", { className: "extc-row-sub", children: [
									t("version") + ": " + (plugin.version || "?"),
									" · " + t("rows") + ": " + plugin.rows,
									" · " + t("source") + ": " + (plugin.source ? plugin.source.kind : "?"),
									" · " + (plugin.enabled ? t("pluginEnabled") : t("pluginDisabled"))
								] })
							] }),
							plugin.builtin ? null : jsxs(Fragment, { children: [
								plugin.rows > 0 ? jsx(Button, { small: true, busy: busy, onClick: function () { toggle(plugin.name, !plugin.enabled); }, children: plugin.enabled ? t("disable") : t("enable") }) : null,
								jsx(Button, { small: true, danger: true, busy: busy, onClick: function () { remove(plugin.name); }, children: t("uninstall") })
							] })
						] }, plugin.name);
					}) }),
					jsx(StatusLine, { error: error, message: message })
				] }),
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("pluginInstallTitle") }),
					jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("pluginSource"), children: jsx(Select, { value: mode, disabled: busy, onChange: setMode, options: [
							{ value: "npm", label: t("pluginModeNpm") },
							{ value: "url", label: t("pluginModeUrl") },
							{ value: "folder", label: t("pluginModeFolder") },
							{ value: "git", label: t("pluginModeGit") }
						] }) }),
						mode === "npm" ? jsx(Field, { label: t("pluginSpec"), hint: t("pluginNameOptional"), children: jsx(TextInput, { value: spec, disabled: busy, onChange: setSpec }) }) : null,
						mode === "url" ? jsx(Field, { label: t("pluginUrl"), children: jsx(TextInput, { value: url, disabled: busy, onChange: setUrl }) }) : null,
						mode === "folder" ? jsx(Field, { label: t("pluginFolder"), children: jsx(TextInput, { value: folder, disabled: busy, onChange: setFolder }) }) : null,
						mode === "git" ? jsx(Field, { label: t("pluginGit"), children: jsx(TextInput, { value: git, disabled: busy, onChange: setGit }) }) : null,
						jsx(Button, { primary: true, busy: busy, disabled: (mode === "npm" && !spec.trim()) || (mode === "url" && !url.trim()) || (mode === "folder" && !folder.trim()) || (mode === "git" && !git.trim()), onClick: install, children: t("install") })
					] })
				] }),
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("loaderTitle") }),
					jsx("ul", { className: "extc-list", children: entries.map(function (entry) {
						return jsxs("li", { className: "extc-row extc-row-flat", children: [
							jsxs("div", { className: "extc-row-main", children: [
								jsx("span", { className: "extc-row-title", children: entry.moduleName }),
								jsx("span", { className: "extc-row-meta", children: entry.entryId + " · " + (entry.enabled ? t("pluginEnabled") : t("pluginDisabled")) + " · " + phaseLabel(t, entry.fiberPhase) })
							] })
						] }, entry.entryId);
					}) })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/SettingsTab.js
		/** The Settings tab: the ext-center settings namespace through the native scope. */
		function SettingsTab(props) {
			var t = props.t;
			var scope = props.scope;
			var snapshot = useSyncExternalStore(
				function (listener) { return scope.subscribe(listener); },
				function () { return scope.getSnapshot(); }
			);
			var ready = snapshot.status === "ready" && snapshot.value !== void 0;
			var _a = useState(null), draft = _a[0], setDraft = _a[1];
			var _b = useState(null), error = _b[0], setError = _b[1];
			var _c = useState(null), message = _c[0], setMessage = _c[1];
			var _d = useState(false), busy = _d[0], setBusy = _d[1];
			useEffect(function () {
				if (!ready || draft !== null) return;
				var value = snapshot.value || {};
				setDraft({
					allowLan: !!value.allowLan,
					skillRoot: typeof value.skillRoot === "string" ? value.skillRoot : "",
					treeRoot: typeof value.treeRoot === "string" ? value.treeRoot : "",
					customSkillDirs: Array.isArray(value.customSkillDirs) ? value.customSkillDirs.join("\n") : ""
				});
			}, [ready, draft, snapshot]);
			var save = useCallback(function () {
				if (!ready || draft === null) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				var value = snapshot.value || {};
				var ops = [];
				var custom = draft.customSkillDirs.split("\n").map(function (line) { return line.trim(); }).filter(function (line) { return line.length > 0; });
				if (!!draft.allowLan !== !!value.allowLan) ops.push(["allowLan", draft.allowLan]);
				if (draft.skillRoot !== (value.skillRoot || "")) ops.push(["skillRoot", draft.skillRoot.trim()]);
				if (draft.treeRoot !== (value.treeRoot || "")) ops.push(["treeRoot", draft.treeRoot.trim()]);
				if (custom.join("\u0000") !== (Array.isArray(value.customSkillDirs) ? value.customSkillDirs.join("\u0000") : "")) ops.push(["customSkillDirs", custom]);
				if (ops.length === 0) {
					setMessage(t("noop"));
					setBusy(false);
					return;
				}
				var chain = Promise.resolve();
				ops.forEach(function (op) {
					chain = chain.then(function () { return scope.set(op[0], op[1]); });
				});
				chain.then(function () {
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, draft, snapshot, scope, t]);
			var reset = useCallback(function (field) {
				if (!ready) return;
				scope.unset(field).then(function () {
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [ready, scope, t]);
			var writable = snapshot.writable !== false;
			return jsxs("div", { className: "extc-panel", children: [
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("settingsTitle") }),
					jsx("p", { className: "extc-empty", children: t("settingsIntro") }),
					!writable ? jsx("p", { className: "extc-error", children: t("readOnly") }) : null,
					!ready ? jsx("p", { className: "extc-empty", children: t("loading") }) : draft === null ? jsx("p", { className: "extc-empty", children: t("loading") }) : jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("allowLan"), hint: t("allowLanHint"), children: jsx("label", { className: "extc-check", children: [
							jsx("input", { type: "checkbox", checked: draft.allowLan, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { allowLan: event.target.checked })); } }),
							jsx("span", { children: draft.allowLan ? t("pluginEnabled") : t("pluginDisabled") })
						] }) }),
						jsx(Field, { label: t("skillRoot"), hint: t("skillRootHint"), children: jsx(TextInput, { value: draft.skillRoot, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { skillRoot: value })); } }) }),
						jsx(Field, { label: t("treeRoot"), hint: t("treeRootHint"), children: jsx(TextInput, { value: draft.treeRoot, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { treeRoot: value })); } }) }),
						jsx(Field, { label: t("customSkillDirs"), hint: t("customSkillDirsHint"), children: jsx(TextArea, { value: draft.customSkillDirs, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { customSkillDirs: value })); }, rows: 4 }) }),
						jsxs("div", { className: "extc-actions", children: [
							jsx(Button, { primary: true, busy: busy, disabled: !writable, onClick: save, children: t("save") }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("allowLan"); }, children: t("reset") + " · allowLan" }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("skillRoot"); }, children: t("reset") + " · skillRoot" }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("treeRoot"); }, children: t("reset") + " · treeRoot" }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("customSkillDirs"); }, children: t("reset") + " · customSkillDirs" })
						] })
					] }),
					jsx(StatusLine, { error: error, message: message })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/TreePanel.js
		/** The sidebar file tree: a footer action that opens a workspace file browser. */
		var TREE_ROOT_QUERY = "/ext/api/tree";
		function treeEntries(path) {
			return callApi(TREE_ROOT_QUERY + (path ? "?path=" + encodeURIComponent(path) : ""));
		}
		function treeFileRead(filePath) {
			return callApi("/ext/api/tree/content?path=" + encodeURIComponent(filePath));
		}
		function treeFileWrite(filePath, content) {
			return callApi("/ext/api/tree/write", { path: filePath, content: content });
		}
		function copyText(text) {
			if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
				return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
			}
			return Promise.resolve(legacyCopy(text));
		}
		function legacyCopy(text) {
			var textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			var ok = false;
			try { ok = document.execCommand("copy"); } catch (error) { /* ignore */ }
			document.body.removeChild(textarea);
			return ok;
		}
		function formatSize(bytes) {
			if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
			if (bytes < 1024) return bytes + " B";
			var units = ["KB", "MB", "GB", "TB"];
			var value = bytes;
			var unit = "B";
			for (var index = 0; index < units.length; index++) {
				value = value / 1024;
				unit = units[index];
				if (value < 1024) break;
			}
			return value.toFixed(value < 10 ? 1 : 0) + " " + unit;
		}
		/**
		 * Sidebar footer action (sidebar.footer.action, id ext-center.tree):
		 * toggles a fixed panel that lazily browses the workspace directory tree,
		 * one level per expand, via /ext/api/tree.
		 */
		function TreeAction(props) {
			var wide = props.wide;
			var t = props.t;
			var _a = useState(false), open = _a[0], setOpen = _a[1];
			var _b = useState(null), root = _b[0], setRoot = _b[1];
			var _c = useState({}), children = _c[0], setChildren = _c[1];
			var _d = useState(function () { return new Set(); }), expanded = _d[0], setExpanded = _d[1];
			var _e = useState(function () { return new Set(); }), loading = _e[0], setLoading = _e[1];
			var _f = useState({}), failures = _f[0], setFailures = _f[1];
			var _g = useState(null), error = _g[0], setError = _g[1];
			var _h = useState(null), copied = _h[0], setCopied = _h[1];
			var copiedTimer = useRef(null);
			var refresh = useCallback(function () {
				setError(null);
				treeEntries("").then(function (value) {
					setRoot(value);
					setChildren({});
					setExpanded(new Set());
					setFailures({});
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, []);
			useEffect(function () {
				if (!open) return;
				refresh();
			}, [open, refresh]);
			var panelRef = useRef(null);
			var triggerRef = useRef(null);
			var _i = useState(null), editing = _i[0], setEditing = _i[1];
			var _j = useState(""), editorText = _j[0], setEditorText = _j[1];
			var _k = useState(null), editorError = _k[0], setEditorError = _k[1];
			var _l = useState(false), editorBusy = _l[0], setEditorBusy = _l[1];
			var _m = useState(null), editorMessage = _m[0], setEditorMessage = _m[1];
			var openFile = useCallback(function (filePath, name) {
				setEditorError(null);
				setEditorMessage(null);
				setEditorText("");
				setEditorBusy(true);
				setEditing({ path: filePath, name: name });
				treeFileRead(filePath).then(function (value) {
					setEditorText(value.content);
					setEditorBusy(false);
				}, function (reason) {
					setEditorError(String(reason && reason.message ? reason.message : reason));
					setEditorBusy(false);
				});
			}, []);
			var saveFile = useCallback(function () {
				if (!editing || editorBusy) return;
				setEditorBusy(true);
				setEditorError(null);
				setEditorMessage(null);
				treeFileWrite(editing.path, editorText).then(function () {
					setEditorMessage(t("saved"));
					setEditorBusy(false);
				}, function (reason) {
					setEditorError(String(reason && reason.message ? reason.message : reason));
					setEditorBusy(false);
				});
			}, [editing, editorText, editorBusy, t]);
			var closeEditor = useCallback(function () {
				setEditing(null);
				setEditorError(null);
				setEditorMessage(null);
			}, []);
			useEffect(function () {
				if (!open) return;
				var onPointerDown = function (event) {
					var target = event.target;
					if (editing !== null) return; // the editor modal owns the pointer
					if (panelRef.current && panelRef.current.contains(target)) return;
					if (triggerRef.current && triggerRef.current.contains(target)) return;
					setOpen(false);
				};
				var onKeyDown = function (event) {
					if (event.key === "Escape" && editing === null) setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return function () {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open, editing]);
			var toggleDir = useCallback(function (dirPath) {
				var isOpen = expanded.has(dirPath);
				setExpanded(function (prev) {
					var next = new Set(prev);
					if (isOpen) next.delete(dirPath);
					else next.add(dirPath);
					return next;
				});
				if (isOpen) return;
				if (children[dirPath] !== undefined) return;
				if (loading.has(dirPath)) return;
				setLoading(function (prev) { var next = new Set(prev); next.add(dirPath); return next; });
				setFailures(function (prev) { var next = Object.assign({}, prev); delete next[dirPath]; return next; });
				treeEntries(dirPath).then(function (value) {
					setChildren(function (prev) {
						var next = Object.assign({}, prev);
						next[dirPath] = value;
						return next;
					});
				}, function (reason) {
					setFailures(function (prev) {
						var next = Object.assign({}, prev);
						next[dirPath] = String(reason && reason.message ? reason.message : reason);
						return next;
					});
				}).then(function () {
					setLoading(function (prev) { var next = new Set(prev); next.delete(dirPath); return next; });
				});
			}, [expanded, children, loading]);
			var copyPath = useCallback(function (dirPath) {
				copyText(dirPath).then(function () {
					setCopied(dirPath);
					if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
					copiedTimer.current = window.setTimeout(function () { setCopied(null); }, 1600);
				});
			}, []);
			var renderNode = function (entry, depth) {
				var indent = { paddingLeft: 10 + depth * 14 };
				if (entry.type === "dir") {
					var isOpen = expanded.has(entry.path);
					var kids = children[entry.path];
					var isLoading = loading.has(entry.path);
					var failed = failures[entry.path];
					var count = typeof entry.children === "number" && entry.children > 0 ? "（" + entry.children + "）" : "";
					return jsxs("li", { className: "extc-tnode", children: [
						jsx("button", {
							type: "button",
							className: "extc-trow",
							style: indent,
							"aria-expanded": isOpen ? "true" : "false",
							title: entry.path,
							onClick: function () { toggleDir(entry.path); },
							children: [
								jsx(_primitives.IconChevronRightOutline14, { className: "extc-tcaret" + (isOpen ? " extc-tcaret-open" : "") }),
								isOpen ? jsx(_primitives.IconFolderOpen16, { size: 14 }) : jsx(_primitives.IconFolderClose16, { size: 14 }),
								jsx("span", { className: "extc-tname", children: entry.name }),
								count ? jsx("span", { className: "extc-tmeta", children: count }) : null,
								isLoading ? jsx("span", { className: "extc-tmeta", children: "…" }) : null
							]
						}),
						jsx("button", {
							type: "button",
							className: "extc-tcopy",
							title: entry.path,
							"aria-label": t("treeCopyPath"),
							onClick: function (event) { event.stopPropagation(); copyPath(entry.path); },
							children: copied === entry.path ? jsx(_primitives.IconCheckOutline16, { size: 12 }) : jsx(_primitives.IconCopyOutline16, { size: 12 })
						}),
						isOpen ? (kids ? (kids.entries.length === 0 ? jsx("div", { className: "extc-tkids", children: jsx("div", { className: "extc-tempty", children: t("treeEmpty") }) }) : jsxs("div", { className: "extc-tkids", children: [
							jsx("ul", { className: "extc-tlist", children: kids.entries.map(function (kid) { return renderNode(kid, depth + 1); }) }),
							kids.truncated ? jsx("div", { className: "extc-tnote", children: t("treeTruncated") }) : null
						] })) : (failed ? jsx("div", { className: "extc-terr", children: failed }) : null)) : null
					] }, entry.path);
				}
				return jsxs("li", { className: "extc-tnode", children: [
					jsx("button", {
						type: "button",
						className: "extc-trow",
						style: indent,
						title: entry.path,
						onClick: function () { openFile(entry.path, entry.name); },
						children: [
							jsx("span", { className: "extc-tdot" }),
							jsx("span", { className: "extc-tname", children: entry.name }),
							typeof entry.size === "number" && entry.size > 0 ? jsx("span", { className: "extc-tmeta", children: formatSize(entry.size) }) : null,
							copied === entry.path ? jsx("span", { className: "extc-tmeta extc-tcopied", children: t("treeCopied") }) : null
						]
					}),
					jsx("button", {
						type: "button",
						className: "extc-tcopy",
						title: entry.path,
						"aria-label": t("treeCopyPath"),
						onClick: function (event) { event.stopPropagation(); copyPath(entry.path); },
						children: copied === entry.path ? jsx(_primitives.IconCheckOutline16, { size: 12 }) : jsx(_primitives.IconCopyOutline16, { size: 12 })
					})
				] }, entry.path);
			};
			var rootName = root ? (root.name || root.root) : t("treePanelTitle");
			return jsxs("div", { className: "extc-tlayer", children: [
				open ? jsxs("section", { className: "extc-tpanel", ref: panelRef, "aria-label": t("treePanelTitle"), children: [
					jsxs("header", { className: "extc-theader", children: [
						jsx("span", { className: "extc-ttitle", title: root ? root.root : "", children: rootName }),
						jsxs("div", { className: "extc-theader-actions", children: [
							jsx(_primitives.Tooltip, { label: t("treeCollapseAll"), delayMs: 400, children: jsx("button", { type: "button", className: "extc-ticon", "aria-label": t("treeCollapseAll"), disabled: expanded.size === 0, onClick: function () { setExpanded(new Set()); }, children: jsx(_primitives.IconPanelLeftOutline16, { size: 14 }) }) }),
							jsx(_primitives.Tooltip, { label: t("treeRefresh"), delayMs: 400, children: jsx("button", { type: "button", className: "extc-ticon", "aria-label": t("treeRefresh"), onClick: refresh, children: jsx(_primitives.IconRefreshOutline16, { size: 14 }) }) })
						] })
					] }),
					jsx("div", { className: "extc-tbody", children: error ? jsxs("div", { className: "extc-terr", children: [t("treeError"), error, jsx("button", { type: "button", className: "extc-tretry", onClick: refresh, children: t("treeRetry") })] }) : root === null ? jsx("p", { className: "extc-tnote", children: t("treeLoading") }) : jsxs("div", { className: "extc-troot", children: [
						root.entries.length === 0 ? jsx("div", { className: "extc-tempty", children: t("treeEmpty") }) : jsx("ul", { className: "extc-tlist", children: root.entries.map(function (entry) { return renderNode(entry, 0); }) }),
						root.truncated ? jsx("div", { className: "extc-tnote", children: t("treeTruncated") }) : null
					] }) })
				] }) : null,
				jsx(_primitives.Tooltip, { label: t("treeTrigger"), delayMs: 400, disabled: wide, children: jsx("button", {
					type: "button",
					ref: triggerRef,
					className: "extc-trigger" + (wide ? "" : " extc-trigger-rail") + (open ? " extc-trigger-open" : ""),
					"aria-label": t("treeTriggerAria"),
					"aria-expanded": open ? "true" : "false",
					onClick: function () { setOpen(function (value) { return !value; }); },
					children: [
						jsx(_primitives.IconFolderOpenOutline16, { size: wide ? 14 : 18 }),
						wide ? jsx("span", { className: "extc-trigger-label", children: t("treeTrigger") }) : null
					]
				}) }),
				jsx(_primitives.Modal, {
					open: editing !== null,
					onClose: closeEditor,
					title: editing ? editing.name : "",
					description: editing ? editing.path : "",
					footer: editing ? jsxs("div", { className: "extc-actions", children: [
						jsx(Button, { primary: true, busy: editorBusy, disabled: editorBusy, onClick: saveFile, children: t("save") }),
						jsx(Button, { small: true, disabled: editorBusy, onClick: closeEditor, children: t("cancel") })
					] }) : null,
					children: jsxs("div", { className: "extc-editor", children: [
						editorError ? jsx("div", { className: "extc-error", children: t("treeError") + editorError }) : null,
						editorMessage ? jsx("div", { className: "extc-ok", children: editorMessage }) : null,
						editorBusy && editorText === "" ? jsx("p", { className: "extc-empty", children: t("treeLoading") }) : jsx(TextArea, { value: editorText, disabled: editorBusy, rows: 18, onChange: setEditorText })
					] })
				})
			] });
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		var NS = "ext-center";
		/** Required services (cordis fiber inject). */
		var inject = ["slots", "locale", "settingsScope"];
		/** The section entry: a settings.section list item with three tabs. */
		function ExtensionCenterSection(props) {
			var t = props.t;
			var _a = useState("skills"), tab = _a[0], setTab = _a[1];
			var tabs = [
				{ id: "skills", label: t("tabSkills") },
				{ id: "plugins", label: t("tabPlugins") },
				{ id: "settings", label: t("tabSettings") }
			];
			return jsxs("div", { className: "extc", children: [
				jsxs("div", { className: "extc-header", children: [
					jsxs("div", { className: "extc-header-main", children: [
						jsx("h2", { className: "extc-title", children: t("title") }),
						jsx("p", { className: "extc-intro", children: t("intro") })
					] }),
				] }),
				jsx("div", { className: "extc-tabs", role: "tablist", children: tabs.map(function (row) {
					var selected = row.id === tab;
					return jsx("button", {
						type: "button",
						role: "tab",
						className: "extc-tab" + (selected ? " extc-tab-active" : ""),
						"aria-selected": selected ? "true" : "false",
						onClick: function () { setTab(row.id); },
						children: row.label
					}, row.id);
				}) }),
				tab === "skills" ? jsx(SkillsTab, { t: t, loadState: props.loadState }) : null,
				tab === "plugins" ? jsx(PluginsTab, { t: t, loadState: props.loadState }) : null,
				tab === "settings" ? jsx(SettingsTab, { t: t, scope: props.scope }) : null
			] });
		}
		/** Mount the Extension Center settings section. */
		function apply(ctx) {
			var t = ctx.locale.bind(NS);
			ctx.effect(function () {
				return ctx.locale.register(NS, { zh: zh, en: en });
			}, "ext-center: dictionaries");
			var scope = ctx.settingsScope.bind({ namespace: NS });
			var loadState = function () {
				return callApi("/ext/api/state");
			};
			ctx.slots.inject("settings.section", function () {
				return ctx.slots.register({
					name: "settings.section",
					id: "ext-center",
					order: 20,
					label: function () { return t("nav"); },
					locale: NS,
					inject: function () { return { loadState: loadState, scope: scope }; },
					children: {}
				}, ExtensionCenterSection);
			});
			ctx.slots.inject("sidebar.footer.action", function () {
				return ctx.slots.register({
					name: "sidebar.footer.action",
					id: "ext-center.tree",
					order: 20,
					label: function () { return t("treeTrigger"); },
					locale: NS
				}, TreeAction);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
