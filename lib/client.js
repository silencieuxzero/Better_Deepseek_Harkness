window.__ModuleLoader__.load({
	id: "better-deepseek-harness",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var _react = require("react");
		var _jsx_runtime = require("react/jsx-runtime");
		var _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var useState = _react.useState, useEffect = _react.useEffect, useCallback = _react.useCallback, useRef = _react.useRef, useSyncExternalStore = _react.useSyncExternalStore;
		var jsx = _jsx_runtime.jsx, jsxs = _jsx_runtime.jsxs, Fragment = _jsx_runtime.Fragment;
		//#region styles
		(function installStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("ext-center-styles")) return;
			var style = document.createElement("style");
			style.id = "ext-center-styles";
			style.setAttribute("data-plugin", "better-deepseek-harness");
			style.textContent = ".extc{display:flex;flex-direction:column;gap:14px;padding:2px 0 10px}\n.extc-panel{display:flex;flex-direction:column;gap:16px}\n.extc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:nowrap}\n.extc-header-main{flex:1;min-width:0}\n.extc-title{margin:0 0 4px;font-size:1.15rem;font-weight:600}\n.extc-intro{margin:0;font-size:.85rem;opacity:.75;line-height:1.5;max-width:72ch}\n.extc-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(128,128,128,.35)}\n.extc-tab{appearance:none;background:transparent;border:none;padding:8px 14px;cursor:pointer;font-size:.9rem;color:inherit;opacity:.7;border-bottom:2px solid transparent;white-space:nowrap;writing-mode:horizontal-tb}\n.extc-tab:hover{opacity:1}\n.extc-tab-active{opacity:1;border-bottom-color:currentColor;font-weight:600}\n.extc-card{border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:14px 16px;background:rgba(128,128,128,.05);display:flex;flex-direction:column;gap:12px}\n.extc-card-title{margin:0 0 4px;font-size:.95rem;font-weight:600}\n.extc-empty{margin:0;font-size:.85rem;opacity:.7;line-height:1.5}\n.extc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}\n.extc-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(128,128,128,.22);border-radius:6px;background:rgba(128,128,128,.04)}\n.extc-row-flat{border-style:dashed}\n.extc-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n.extc-row-title{font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.extc-row-sub{font-size:.8rem;opacity:.75;line-height:1.4}\n.extc-row-meta{font-size:.75rem;opacity:.55;font-family:ui-monospace,Consolas,monospace;word-break:break-all}\n.extc-tag{font-size:.65rem;padding:1px 6px;border-radius:99px;border:1px solid rgba(128,128,128,.4);opacity:.8}\n.extc-form{display:flex;flex-direction:column;gap:20px}\n.extc-field{display:flex;flex-direction:column;gap:7px}\n.extc-field-label{font-size:.82rem;font-weight:500;display:flex;flex-direction:column;gap:2px}\n.extc-field-hint{font-size:.72rem;opacity:.6;font-weight:400}\n.extc-input{font:inherit;font-size:.85rem;padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;width:100%;box-sizing:border-box}\n.extc-textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:.8rem}\n.extc-check{display:flex;align-items:center;gap:8px;font-size:.85rem}\n.extc-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.extc-btn{font:inherit;font-size:.82rem;padding:6px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;cursor:pointer;white-space:nowrap;flex:none;writing-mode:horizontal-tb}\n.extc-btn:hover{background:rgba(128,128,128,.12)}\n.extc-btn:disabled{opacity:.45;cursor:default}\n.extc-btn-primary{background:rgba(64,128,255,.16);border-color:rgba(64,128,255,.5);font-weight:600}\n.extc-btn-danger{border-color:rgba(255,80,80,.5);color:#e05c5c}\n.extc-btn-small{padding:3px 8px;font-size:.75rem}\n.extc-status{display:flex;flex-direction:column;gap:4px;font-size:.82rem}\n.extc-error{color:#e05c5c;font-size:.82rem;margin:0;line-height:1.4}\n.extc-ok{color:#3fae6a;font-size:.82rem;margin:0;line-height:1.4}\n.extc-tlayer{flex:none;position:relative;width:100%;height:49px;margin:8px 0 0;display:flex;align-items:center}\n.extc-trigger{width:100%;height:49px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;opacity:.85}\n.extc-trigger:hover,.extc-trigger-open{background:rgba(128,128,128,.12);opacity:1}\n.extc-trigger-rail{width:36px;height:36px;border-radius:50%;justify-content:center;gap:0;padding:0}\n.extc-trigger-label{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tpanel{z-index:30;border:1px solid rgba(128,128,128,.3);background:var(--dsw-alias-bg-base,rgba(24,24,27,.98));width:380px;max-width:calc(100vw - 24px);max-height:60vh;border-radius:12px;flex-direction:column;display:flex;position:fixed;bottom:128px;left:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}\n.extc-theader{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.25)}\n.extc-ttitle{font-size:13px;font-weight:500;line-height:20px;min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-ticon{width:28px;height:28px;border:none;background:0 0;border-radius:50%;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:.8}\n.extc-ticon:hover{background:rgba(128,128,128,.15)}\n.extc-tbody{flex:1;min-height:0;padding:6px 8px 10px;overflow-y:auto;overscroll-behavior:contain}\n.extc-tlist{margin:0;padding:0;list-style:none}\n.extc-tnode{margin:0;padding:0;position:relative;display:flex;flex-wrap:wrap;align-items:center}\n.extc-trow{width:auto;flex:1;min-width:0;border:none;background:0 0;color:inherit;font-family:inherit;font-size:13px;line-height:24px;display:flex;align-items:center;gap:4px;cursor:pointer;border-radius:6px;text-align:left;padding-right:8px}\n.extc-trow:hover{background:rgba(128,128,128,.1)}\n.extc-tcaret{flex:none;opacity:.6;transition:transform .12s ease}\n.extc-tcaret-open{transform:rotate(90deg)}\n.extc-tname{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tdot{flex:none;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.45;margin:0 5px}\n.extc-tmeta{margin-left:auto;flex:none;font-size:11px;opacity:.55;padding-left:8px}\n.extc-tcopied{opacity:.9}\n.extc-tempty{font-size:12px;opacity:.6;padding:2px 0 2px 26px;line-height:20px}\n.extc-terr{font-size:12px;line-height:18px;color:#e05c5c;padding:4px 8px}\n.extc-tnote{font-size:12px;opacity:.6;padding:6px 8px;margin:0;line-height:18px}\n.extc-tretry{margin-left:8px;border:none;background:0 0;color:inherit;cursor:pointer;text-decoration:underline;font-size:12px;padding:0}\n.extc-theader-actions{display:flex;align-items:center;gap:2px}\n.extc-ticon:disabled{opacity:.35;cursor:default}\n.extc-tkids{width:100%}\n.extc-tcopy{flex:none;width:22px;height:22px;border:none;background:0 0;border-radius:4px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .1s ease}\n.extc-tnode:hover .extc-tcopy,.extc-tcopy:focus-visible{opacity:.75}\n.extc-tcopy:hover{opacity:1;background:rgba(128,128,128,.15)}\n.extc-modal-dialog{width:min(1024px,94vw);max-width:94vw}\n.extc-editor{display:flex;flex-direction:column;gap:8px;min-width:420px}\n.extc-editor .extc-textarea{width:100%;aspect-ratio:16/9;min-height:260px;max-height:75vh;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:.8rem;line-height:1.5;resize:none}\n.extc-term{display:flex;flex-direction:column;gap:8px;min-height:340px;color:var(--dsw-static-neutral-bluish-950,rgb(21,21,23))}\n.extc-term-panel{flex:1;min-height:320px;display:flex;flex-direction:column;background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255));border:1px solid rgba(0,0,0,.14);border-radius:6px;overflow:hidden}\n.extc-term-bar{flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px 0;border-bottom:1px solid rgba(0,0,0,.12);background:var(--dsw-static-neutral-bluish-50,rgb(249,250,251))}\n.extc-term-tabs{margin:0;padding:0;list-style:none;display:flex;align-items:stretch;gap:2px;min-width:0;flex:1;overflow-x:auto;scrollbar-width:none}\n.extc-term-tabs::-webkit-scrollbar{display:none}\n.extc-term-tab{position:relative;display:flex;align-items:center;gap:4px;margin-bottom:-1px;border-radius:6px 6px 0 0;background:rgba(0,0,0,.05);border:1px solid rgba(0,0,0,.1);border-bottom-color:transparent;padding:0 6px 0 10px;min-width:0;max-width:220px}\n.extc-term-tab:hover{background:rgba(0,0,0,.09)}\n.extc-term-tab-active{background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255));border-color:rgba(0,0,0,.14);border-bottom-color:transparent}\n.extc-term-tab-active::before{content:'';position:absolute;top:0;left:4px;right:4px;height:2px;background:#0969da;border-radius:2px}\n.extc-term-tab-sel{flex:1;min-width:0;display:inline-flex;align-items:center;gap:6px;border:none;background:0 0;color:inherit;font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;padding:5px 0;cursor:pointer;text-align:left}\n.extc-term-tab-name{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-term-dot{flex:none;width:7px;height:7px;border-radius:50%;background:#3fae6a}\n.extc-term-dot-dead{background:#9a9aa0}\n.extc-term-tab-close{flex:none;width:18px;height:18px;border:none;background:0 0;border-radius:3px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .1s ease}\n.extc-term-tab:hover .extc-term-tab-close,.extc-term-tab-active .extc-term-tab-close,.extc-term-tab-close:focus-visible{opacity:.65}\n.extc-term-tab-close:hover{opacity:1;background:rgba(0,0,0,.1)}\n.extc-term-add{flex:none;border:none;background:0 0;color:inherit;font:inherit;font-size:.75rem;padding:4px 8px;border-radius:4px;cursor:pointer;opacity:.8;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}\n.extc-term-add:hover{background:rgba(0,0,0,.08);opacity:1}\n.extc-term-add:disabled{opacity:.35;cursor:default}\n.extc-term-count{flex:none;font-size:.72rem;opacity:.6;white-space:nowrap;padding:0 4px}\n.extc-term-out{flex:1;min-height:280px;max-height:60vh;overflow:auto;margin:0;padding:10px 14px;background:0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;line-height:1.5;white-space:pre-wrap;word-break:break-all;tab-size:4;color:inherit}\n.extc-term-out::-webkit-scrollbar{width:10px;height:10px}\n.extc-term-out::-webkit-scrollbar-thumb{background:rgba(0,0,0,.25);border-radius:5px;border:2px solid transparent;background-clip:content-box}\n.extc-term-out::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.4);border:2px solid transparent;background-clip:content-box}\n.extc-term-in{flex:none;display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid rgba(0,0,0,.1);background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255))}\n.extc-term-prompt{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;font-weight:600;opacity:.55;user-select:none}\n.extc-term-in .extc-input{flex:1;border:none;background:0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;padding:4px 2px;box-shadow:none}\n.extc-term-in .extc-input:focus{outline:none}\n.extc-term-empty{margin:auto 0;align-self:center;text-align:center;padding:18px 26px;border:1px dashed rgba(0,0,0,.28);border-radius:8px;background:#fff;color:rgba(0,0,0,.85);box-shadow:0 2px 10px rgba(0,0,0,.3);font-size:1.05rem;line-height:1.6}\n.extc-term-dark{color:var(--dsw-static-neutral-bluish-50,rgb(250,250,250))}\n.extc-term-dark .extc-term-panel{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-color:rgba(255,255,255,.14)}\n.extc-term-dark .extc-term-bar{background:rgba(255,255,255,.04);border-bottom-color:rgba(255,255,255,.14)}\n.extc-term-dark .extc-term-tab{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}\n.extc-term-dark .extc-term-tab:hover{background:rgba(255,255,255,.1)}\n.extc-term-dark .extc-term-tab-active{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-color:rgba(255,255,255,.16)}\n.extc-term-dark .extc-term-tab-active::before{background:#4b9bff}\n.extc-term-dark .extc-term-tab-close:hover{background:rgba(255,255,255,.16)}\n.extc-term-dark .extc-term-add:hover{background:rgba(255,255,255,.12)}\n.extc-term-dark .extc-term-in{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-top-color:rgba(255,255,255,.12)}\n.extc-term-dark .extc-term-out::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3)}\n.extc-term-dark .extc-term-out::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.5)}\n@media (max-width:760px){.extc-term{min-height:280px}.extc-term-panel{min-height:260px}.extc-term-out{min-height:220px}}\n.extc-git{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow:hidden;padding:2px 0 0}\n.extc-git-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0 8px;border-bottom:1px solid rgba(128,128,128,.22)}\n.extc-git-bar .extc-input{min-width:150px;max-width:230px;font-size:.82rem;padding:4px 8px}\n.extc-git-ab{font-family:ui-monospace,Consolas,monospace;font-size:.75rem;opacity:.8;white-space:nowrap}\n.extc-git-ab-up{color:#2da44e}\n.extc-git-ab-down{color:#f85149}\n.extc-git-spacer{flex:1}\n.extc-git-main{display:flex;gap:10px;flex:1;min-height:0}\n.extc-git-col{display:flex;flex-direction:column;gap:10px;flex:0 0 320px;min-width:0;overflow-y:auto;padding-right:4px}\n.extc-git-commit-box{display:flex;flex-direction:column;gap:8px;border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:10px;background:rgba(128,128,128,.05)}\n.extc-git-commit-box .extc-input{width:100%;box-sizing:border-box;resize:vertical;min-height:60px}\n.extc-git-commit-actions{display:flex;align-items:center;gap:10px}\n.extc-git-commit-count{font-size:.75rem;opacity:.65}\n.extc-git-group{display:flex;flex-direction:column;gap:2px}\n.extc-git-group-head{display:flex;align-items:center;gap:8px;padding:6px 2px 2px}\n.extc-git-group-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;opacity:.85;flex:1;min-width:0}\n.extc-git-group-count{font-size:.72rem;opacity:.6}\n.extc-git-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent}\n.extc-git-row:hover{background:rgba(128,128,128,.1)}\n.extc-git-row-sel{background:rgba(56,139,253,.14);border-color:rgba(56,139,253,.45)}\n.extc-git-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}\n.extc-git-row-name{font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.extc-git-row-dir{font-size:.7rem;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,Consolas,monospace}\n.extc-git-row-sub{font-size:.7rem;opacity:.55}\n.extc-git-badge{flex:none;width:15px;height:15px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff}\n.extc-git-badge-mod{background:#d29922}\n.extc-git-badge-add{background:#2da44e}\n.extc-git-badge-del{background:#f85149}\n.extc-git-badge-ren{background:#a371f7}\n.extc-git-row-actions{flex:none;display:flex;gap:2px;opacity:0}\n.extc-git-row:hover .extc-git-row-actions{opacity:1}\n.extc-git-ibtn{appearance:none;background:transparent;border:1px solid transparent;border-radius:5px;color:inherit;cursor:pointer;font-size:.85rem;line-height:1;padding:3px 6px;opacity:.75;white-space:nowrap}\n.extc-git-ibtn:hover{opacity:1;background:rgba(128,128,128,.16)}\n.extc-git-ibtn-danger:hover{color:#f85149}\n.extc-git-diff{flex:1;min-width:0;display:flex;flex-direction:column;border:1px solid rgba(128,128,128,.22);border-radius:8px;overflow:hidden;background:rgba(128,128,128,.04)}\n.extc-git-diff-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.22);flex-wrap:wrap}\n.extc-git-diff-path{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;flex:1;min-width:0;word-break:break-all}\n.extc-git-diff-tag{font-size:.68rem;padding:1px 8px;border-radius:99px;border:1px solid rgba(128,128,128,.4);opacity:.85;white-space:nowrap}\n.extc-git-diff-body{flex:1;overflow:auto;padding:8px 0}\n.extc-gd-line{display:flex;align-items:baseline;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.76rem;line-height:1.55;white-space:pre-wrap;word-break:break-all;tab-size:4}\n.extc-gd-no{flex:none;width:46px;padding-right:10px;text-align:right;opacity:.45;user-select:none}\n.extc-gd-text{flex:1;min-width:0;padding:0 12px 0 4px}\n.extc-gd-add{background:rgba(46,160,67,.14)}\n.extc-gd-add .extc-gd-text{color:rgba(63,185,80,.92)}\n.extc-gd-del{background:rgba(248,81,73,.13)}\n.extc-gd-del .extc-gd-text{color:rgba(255,123,114,.92)}\n.extc-gd-hunk{background:rgba(56,139,253,.14);font-weight:600}\n.extc-gd-hunk .extc-gd-text{color:rgba(88,166,255,.95)}\n.extc-gd-meta{opacity:.55}\n.extc-gd-raw{opacity:.85}\n.extc-git-log{display:flex;flex-direction:column;gap:2px}\n.extc-git-log-row{display:flex;flex-direction:column;gap:1px;padding:5px 6px;border-radius:6px}\n.extc-git-log-row:hover{background:rgba(128,128,128,.08)}\n.extc-git-log-subject{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.extc-git-log-meta{font-size:.68rem;opacity:.55;display:flex;gap:8px}\n.extc-git-note{margin:0;font-size:.82rem;opacity:.7;line-height:1.5;padding:8px 10px;border:1px dashed rgba(128,128,128,.35);border-radius:8px}\n.extc-git-pick{display:flex;align-items:center;justify-content:center;flex:1;font-size:.85rem;opacity:.6;padding:40px 16px;text-align:center}\n@media (max-width:880px){.extc-git-main{flex-direction:column;overflow-y:auto}.extc-git-col{flex:none;overflow:visible}.extc-git-diff{min-height:320px;flex:none}}";
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
			emptyPlugins: "还没有通过更好的 DeepSeek Harness 安装任何插件。",
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
			settingsTitle: "插件设置",
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
			treeCopyPath: "复制路径",
			tabTerminals: "终端",
			termNew: "新建终端",
			termCmd: "CMD",
			termPowerShell: "PowerShell",
			termRunning: "运行中",
			termExited: "已退出",
			termEmpty: "还没有终端，选择 CMD 或 PowerShell 新建一个。",
			termInput: "输入命令，回车发送…",
			termSend: "发送",
			termInterrupt: "中断 (Ctrl+C)",
			termKill: "关闭终端",
			termCap: "终端数量已达上限（8 个）",
			tabGit: "Git",
			gitBranch: "分支",
			gitDetached: "游离 HEAD",
			gitAhead: "领先",
			gitBehind: "落后",
			gitRefresh: "刷新",
			gitPull: "拉取",
			gitPush: "推送",
			gitCommitMsg: "提交信息（第一行作为标题；Ctrl+Enter 提交）",
			gitCommit: "提交",
			gitCommitN: "提交（已暂存 {n} 项）",
			gitStaged: "已暂存的更改",
			gitUnstaged: "未暂存的更改",
			gitUntracked: "未跟踪的文件",
			gitStageAll: "全部暂存",
			gitUnstageAll: "全部取消暂存",
			gitStage: "暂存",
			gitUnstage: "取消暂存",
			gitDiscard: "放弃更改",
			gitDiscardConfirm: "确定放弃更改？此操作不可恢复：",
			gitRenamedFrom: "重命名自",
			gitCopiedFrom: "复制自",
			gitDiffPick: "从左侧列表选择文件查看差异",
			gitDiffStagedTag: "已暂存",
			gitDiffWorkTag: "未暂存",
			gitDiffUntrackedTag: "未跟踪",
			gitDiffBinary: "二进制文件",
			gitDiffTruncated: "差异过大，已截断显示。",
			gitDiffClose: "关闭差异",
			gitHistory: "提交历史",
			gitHistoryEmpty: "还没有提交。",
			gitLoading: "正在读取…",
			gitCommitOk: "提交成功",
			gitPullOk: "拉取完成",
			gitPushOk: "推送完成",
			gitCheckoutOk: "已切换到分支 ",
			gitStageOk: "已暂存",
			gitUnstageOk: "已取消暂存",
			gitDiscardOk: "已放弃更改",
			gitUpstream: "上游",
			gitNoRepo: "当前文件树不在 Git 仓库中。",
			gitEmpty: "工作区干净，没有更改。",
			gitNoStaged: "没有暂存的更改可提交。",
			gitConflictHint: "存在合并冲突，请先解决冲突再提交。",
			tabMcp: "MCP",
			mcpIntro: "配置自定义 MCP 服务器。每个服务器是 cordis.patch.yml 中的一行 dsh-mcp-client 条目，由配置监听器热生效；服务器工具以 mcp__<名称>__<工具名> 的形式提供给模型。",
			mcpListTitle: "MCP 服务器",
			mcpEmpty: "还没有配置任何 MCP 服务器。",
			mcpExternal: "外部配置（只读）",
			mcpAddTitle: "添加 MCP 服务器",
			mcpName: "服务器名称",
			mcpNameHint: "1-32 位字母、数字、下划线或连字符；模型工具名将是 mcp__<名称>__<工具>",
			mcpTransport: "传输方式",
			mcpStdio: "stdio（本地命令）",
			mcpHttp: "streamable-http（远程 URL）",
			mcpCommand: "命令",
			mcpCommandHint: "可执行文件，如 npx 或绝对路径",
			mcpArgs: "参数（每行一个）",
			mcpArgsHint: "例如 -y @modelcontextprotocol/server-filesystem C:\\path",
			mcpEnv: "环境变量（每行 KEY=VALUE）",
			mcpEnvHint: "仅字符串字面量；写入 profile 的 cordis.patch.yml",
			mcpCwd: "工作目录",
			mcpCwdHint: "留空使用启动目录",
			mcpUrl: "服务器 URL",
			mcpUrlHint: "如 http://localhost:3000/mcp",
			mcpHeaders: "请求头（每行 名称: 值）",
			mcpHeadersHint: "例如 Authorization: Bearer token",
			mcpTimeout: "工具调用超时（毫秒）",
			mcpTimeoutHint: "留空使用默认 60000",
			mcpAdd: "添加",
			mcpRemove: "移除",
			mcpRemoveConfirm: "确定移除 MCP 服务器 ",
			mcpEnable: "启用",
			mcpDisable: "停用",
			mcpEnableOk: "已启用：",
			mcpDisableOk: "已停用：",
			mcpAdded: "MCP 服务器已添加：",
			mcpRemoved: "MCP 服务器已移除：",
			mcpRestartNote: "主机行热生效；工具在模型下一次请求即可见。",
			mcpCap: "MCP 服务器数量已达上限（16 个）",
			mcpPhaseNull: "未加载",
			mcpDisabled: "已停用"
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
			settingsTitle: "Plugin settings",
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
			treeCopyPath: "Copy path",
			tabTerminals: "Terminals",
			termNew: "New terminal",
			termCmd: "CMD",
			termPowerShell: "PowerShell",
			termRunning: "Running",
			termExited: "Exited",
			termEmpty: "No terminals yet — pick CMD or PowerShell to start one.",
			termInput: "Type a command and press Enter…",
			termSend: "Send",
			termInterrupt: "Interrupt (Ctrl+C)",
			termKill: "Close terminal",
			termCap: "Terminal limit reached (8)",
			tabGit: "Git",
			gitBranch: "Branch",
			gitDetached: "Detached HEAD",
			gitAhead: "ahead",
			gitBehind: "behind",
			gitRefresh: "Refresh",
			gitPull: "Pull",
			gitPush: "Push",
			gitCommitMsg: "Commit message (first line is the title; Ctrl+Enter to commit)",
			gitCommit: "Commit",
			gitCommitN: "Commit ({n} staged)",
			gitStaged: "Staged Changes",
			gitUnstaged: "Changes",
			gitUntracked: "Untracked Files",
			gitStageAll: "Stage All",
			gitUnstageAll: "Unstage All",
			gitStage: "Stage",
			gitUnstage: "Unstage",
			gitDiscard: "Discard",
			gitDiscardConfirm: "Discard changes? This cannot be undone:",
			gitRenamedFrom: "renamed from",
			gitCopiedFrom: "copied from",
			gitDiffPick: "Pick a file on the left to see the diff",
			gitDiffStagedTag: "Staged",
			gitDiffWorkTag: "Unstaged",
			gitDiffUntrackedTag: "Untracked",
			gitDiffBinary: "Binary file",
			gitDiffTruncated: "Diff too large — showing a truncated view.",
			gitDiffClose: "Close diff",
			gitHistory: "History",
			gitHistoryEmpty: "No commits yet.",
			gitLoading: "Loading…",
			gitCommitOk: "Committed",
			gitPullOk: "Pull complete",
			gitPushOk: "Push complete",
			gitCheckoutOk: "Switched to branch ",
			gitStageOk: "Staged",
			gitUnstageOk: "Unstaged",
			gitDiscardOk: "Changes discarded",
			gitUpstream: "upstream",
			gitNoRepo: "The current file tree is not inside a git repository.",
			gitEmpty: "Working tree clean — no changes.",
			gitNoStaged: "Nothing staged to commit.",
			gitConflictHint: "Merge conflicts present — resolve them before committing.",
			tabMcp: "MCP",
			mcpIntro: "Configure custom MCP servers. Each server is one dsh-mcp-client row in cordis.patch.yml, activated live by the config watcher; its tools reach the model as mcp__<name>__<tool>.",
			mcpListTitle: "MCP servers",
			mcpEmpty: "No MCP servers configured yet.",
			mcpExternal: "External (read-only)",
			mcpAddTitle: "Add an MCP server",
			mcpName: "Server name",
			mcpNameHint: "1-32 letters, digits, underscores, or hyphens; model tools become mcp__<name>__<tool>",
			mcpTransport: "Transport",
			mcpStdio: "stdio (local command)",
			mcpHttp: "streamable-http (remote URL)",
			mcpCommand: "Command",
			mcpCommandHint: "Executable, e.g. npx or an absolute path",
			mcpArgs: "Arguments (one per line)",
			mcpArgsHint: "e.g. -y @modelcontextprotocol/server-filesystem C:\\path",
			mcpEnv: "Environment (KEY=VALUE per line)",
			mcpEnvHint: "String literals only; written to the profile's cordis.patch.yml",
			mcpCwd: "Working directory",
			mcpCwdHint: "Leave empty for the launch directory",
			mcpUrl: "Server URL",
			mcpUrlHint: "e.g. http://localhost:3000/mcp",
			mcpHeaders: "Headers (Name: Value per line)",
			mcpHeadersHint: "e.g. Authorization: Bearer token",
			mcpTimeout: "Tool call timeout (ms)",
			mcpTimeoutHint: "Leave empty for the 60000 default",
			mcpAdd: "Add",
			mcpRemove: "Remove",
			mcpRemoveConfirm: "Remove MCP server ",
			mcpEnable: "Enable",
			mcpDisable: "Disable",
			mcpEnableOk: "Enabled: ",
			mcpDisableOk: "Disabled: ",
			mcpAdded: "MCP server added: ",
			mcpRemoved: "MCP server removed: ",
			mcpRestartNote: "Host rows activate live; tools become visible to the model on the next request.",
			mcpCap: "MCP server limit reached (16)",
			mcpPhaseNull: "Not loaded",
			mcpDisabled: "Disabled"
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
					className: "extc-modal-dialog",
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
		//#region lib/types/client/TerminalTab.js
		/** The Terminals tab: multiple CMD/PowerShell sessions, one active at a time. */
		var TERMINAL_MAX = 8;
		var TERMINAL_POLL_MS = 300;
		var TERMINAL_LIST_POLL_MS = 2000;
		var TERMINAL_DISPLAY_LIMIT = 200000;
		function TerminalTab(props) {
			var t = props.t;
			var themeDark = typeof props.themeDark === "function" ? props.themeDark : function () { return false; };
			var themeSubscribe = typeof props.themeSubscribe === "function" ? props.themeSubscribe : function () { return function () { }; };
			var dark = useSyncExternalStore(themeSubscribe, themeDark);
			var _a = useState([]), terminals = _a[0], setTerminals = _a[1];
			var _b = useState(null), activeId = _b[0], setActiveId = _b[1];
			var _c = useState(""), output = _c[0], setOutput = _c[1];
			var _d = useState(""), draft = _d[0], setDraft = _d[1];
			var _e = useState(null), busy = _e[0], setBusy = _e[1];
			var _f = useState(null), error = _f[0], setError = _f[1];
			var cursor = useRef(0);
			var outputRef = useRef(null);
			var active = null;
			for (var i = 0; i < terminals.length; i++) {
				if (terminals[i].id === activeId) { active = terminals[i]; break; }
			}
			if (!active && terminals.length > 0) active = terminals[0];
			var activeKey = active ? active.id : null;
			var loadList = useCallback(function () {
				callApi("/ext/api/terminal/list").then(function (value) {
					setTerminals(value.terminals);
					setActiveId(function (prev) {
						if (prev && value.terminals.some(function (x) { return x.id === prev; })) return prev;
						return value.terminals.length > 0 ? value.terminals[0].id : null;
					});
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, []);
			useEffect(function () { loadList(); }, [loadList]);
			useEffect(function () {
				var timer = window.setInterval(loadList, TERMINAL_LIST_POLL_MS);
				return function () { window.clearInterval(timer); };
			}, [loadList]);
			useEffect(function () {
				cursor.current = 0;
				setOutput("");
			}, [activeKey]);
			useEffect(function () {
				if (!activeKey) return;
				var timer = window.setInterval(function () {
					callApi("/ext/api/terminal/output?id=" + encodeURIComponent(activeKey) + "&after=" + cursor.current).then(function (value) {
						if (value.text) {
							setOutput(function (prev) {
								var next = prev + value.text;
								return next.length > TERMINAL_DISPLAY_LIMIT ? next.slice(next.length - TERMINAL_DISPLAY_LIMIT) : next;
							});
							cursor.current += value.text.length;
						}
						if (!value.alive) {
							setTerminals(function (prev) {
								return prev.map(function (x) {
									if (x.id !== activeKey || x.alive === false) return x;
									return Object.assign({}, x, { alive: false, exitCode: value.exitCode });
								});
							});
						}
					}, function () { /* transient poll failures are ignored */ });
				}, TERMINAL_POLL_MS);
				return function () { window.clearInterval(timer); };
			}, [activeKey]);
			useEffect(function () {
				var el = outputRef.current;
				if (el) el.scrollTop = el.scrollHeight;
			}, [output]);
			var switchTo = useCallback(function (id) {
				setActiveId(id);
				cursor.current = 0;
				setOutput("");
			}, []);
			var send = useCallback(function () {
				if (!active) return;
				callApi("/ext/api/terminal/write", { id: active.id, data: draft + "\r" }).then(function () {
					setDraft("");
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [active, draft]);
			var interrupt = useCallback(function () {
				if (!active) return;
				callApi("/ext/api/terminal/write", { id: active.id, data: "\u0003" }).then(function () { }, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
			});
			}, [active]);
			var createTerm = useCallback(function (kind) {
				if (busy !== null) return;
				setBusy(kind);
				setError(null);
				callApi("/ext/api/terminal/create", { kind: kind }).then(function (value) {
					setBusy(null);
					cursor.current = 0;
					setOutput("");
					setActiveId(value.id);
					loadList();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, loadList]);
			var killTerm = useCallback(function (id) {
				setError(null);
				callApi("/ext/api/terminal/kill", { id: id }).then(function () {
					if (id === activeId) {
						setActiveId(null);
						cursor.current = 0;
						setOutput("");
					}
					loadList();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [activeId, loadList]);
			var atCap = terminals.length >= TERMINAL_MAX;
			return jsxs("div", { className: "extc-term" + (dark ? " extc-term-dark" : ""), children: [
				error ? jsx("div", { className: "extc-error", children: error }) : null,
				jsxs("div", { className: "extc-term-panel", children: [
					jsxs("div", { className: "extc-term-bar", children: [
						jsx("ul", { className: "extc-term-tabs", children: terminals.map(function (term, index) {
							return jsxs("li", { className: "extc-term-tab" + (term.id === activeId ? " extc-term-tab-active" : ""), children: [
								jsx("button", { type: "button", className: "extc-term-tab-sel", onClick: function () { switchTo(term.id); }, children: [
									jsx("span", { className: "extc-term-dot" + (term.alive === false ? " extc-term-dot-dead" : "") }),
									jsx("span", { className: "extc-term-tab-name", children: (index + 1) + ": " + term.kind })
								] }),
								jsx("button", { type: "button", className: "extc-term-tab-close", title: t("termKill"), "aria-label": t("termKill"), onClick: function () { killTerm(term.id); }, children: jsx(_primitives.IconCloseOutline16, { size: 12 }) })
							] }, term.id);
						}) }),
						jsx("button", { type: "button", className: "extc-term-add", disabled: busy !== null || atCap, onClick: function () { createTerm("cmd"); }, children: busy === "cmd" ? "…" : "+ " + t("termCmd") }),
						jsx("button", { type: "button", className: "extc-term-add", disabled: busy !== null || atCap, onClick: function () { createTerm("powershell"); }, children: busy === "powershell" ? "…" : "+ " + t("termPowerShell") }),
						jsx("span", { className: "extc-term-count", children: atCap ? t("termCap") : (terminals.length + " / " + TERMINAL_MAX) })
					] }),
					active ? jsxs(Fragment, { children: [
						jsx("pre", { className: "extc-term-out", ref: outputRef, children: output }),
						jsxs("div", { className: "extc-term-in", children: [
							jsx("span", { className: "extc-term-prompt", children: active.kind === "powershell" ? "PS" : ">" }),
							jsx("input", { type: "text", className: "extc-input", value: draft, placeholder: t("termInput"), disabled: active.alive === false, onChange: function (event) { setDraft(event.target.value); }, onKeyDown: function (event) { if (event.key === "Enter") { event.preventDefault(); send(); } } }),
							jsx(Button, { small: true, disabled: active.alive === false, onClick: interrupt, children: t("termInterrupt") }),
							jsx(Button, { small: true, disabled: active.alive === false, onClick: send, children: t("termSend") })
						] })
					] }) : jsx("div", { className: "extc-term-empty", children: t("termEmpty") })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/GitTab.js
		/** The Git tab: a VSCode-style Source Control view over the tree-root repository. */
		var GIT_POLL_MS = 5000;
		/** Split a repo-relative git path into basename + directory for the row layout. */
		function gitPathParts(path) {
			var at = path.lastIndexOf("/");
			if (at < 0) return { name: path, dir: "" };
			return { name: path.slice(at + 1), dir: path.slice(0, at) };
		}
		/** One colored status badge (VSCode Source Control letter colors). */
		function GitBadge(props) {
			var kind = "mod";
			var label = props.untracked ? "U" : props.x && props.x !== "." ? props.x : props.y || "";
			if (props.untracked) kind = "add";
			else if (props.unmerged) { kind = "del"; label = "!"; }
			else if (props.x === "A" || props.x === "C") kind = "add";
			else if (props.x === "D" || props.y === "D") kind = "del";
			else if (props.x === "R") kind = "ren";
			return jsx("span", { className: "extc-git-badge extc-git-badge-" + kind, children: label });
		}
		/** One change row: badge, path, and the stage/unstage + discard actions. */
		function GitRow(props) {
			var change = props.change;
			var t = props.t;
			var parts = gitPathParts(change.path);
			return jsxs("div", {
				className: "extc-git-row" + (props.selected ? " extc-git-row-sel" : ""),
				onClick: function () { props.onOpen(); },
				children: [
					jsx(GitBadge, { x: change.x, y: change.y, untracked: change.untracked === true, unmerged: change.unmerged === true }),
					jsxs("div", { className: "extc-git-row-main", children: [
						jsx("span", { className: "extc-git-row-name", children: parts.name }),
						jsx("span", { className: "extc-git-row-dir", children: [
							parts.dir ? parts.dir : null,
							change.renamed ? t("gitRenamedFrom") + " " + change.orig : null,
							change.copied ? t("gitCopiedFrom") + " " + change.orig : null
						] })
					] }),
					jsxs("div", { className: "extc-git-row-actions", children: [
						jsx("button", {
							type: "button",
							className: "extc-git-ibtn",
							title: props.group === "staged" ? t("gitUnstage") : t("gitStage"),
							onClick: function (event) { event.stopPropagation(); props.onToggle(); },
							children: props.group === "staged" ? "−" : "+"
						}),
						jsx("button", {
							type: "button",
							className: "extc-git-ibtn extc-git-ibtn-danger",
							title: t("gitDiscard"),
							onClick: function (event) { event.stopPropagation(); props.onDiscard(); },
							children: "✕"
						})
					] })
				]
			});
		}
		/** One diff line with per-side line numbers and kind coloring. */
		function GitDiffLine(props) {
			var line = props.line;
			var kind = line.kind;
			var oldNo = line.oldNo === null || line.oldNo === void 0 ? "" : String(line.oldNo);
			var newNo = line.newNo === null || line.newNo === void 0 ? "" : String(line.newNo);
			var cls = "extc-gd-line";
			if (kind === "add") cls += " extc-gd-add";
			else if (kind === "del") cls += " extc-gd-del";
			else if (kind === "hunk") cls += " extc-gd-hunk";
			else if (kind === "meta") cls += " extc-gd-meta";
			else if (kind === "raw") cls += " extc-gd-raw";
			return jsxs("div", { className: cls, children: [
				jsx("span", { className: "extc-gd-no", children: oldNo }),
				jsx("span", { className: "extc-gd-no", children: newNo }),
				jsx("span", { className: "extc-gd-text", children: line.text })
			] });
		}
		/** The Git tab: change groups, commit box, diff view, history, and sync. */
		function GitTab(props) {
			var t = props.t;
			var _a = useState(null), repo = _a[0], setRepo = _a[1];
			var _b = useState([]), branches = _b[0], setBranches = _b[1];
			var _c = useState([]), commits = _c[0], setCommits = _c[1];
			var _d = useState(""), message = _d[0], setMessage = _d[1];
			var _e = useState(null), sel = _e[0], setSel = _e[1];
			var _f = useState(null), diff = _f[0], setDiff = _f[1];
			var _g = useState(null), error = _g[0], setError = _g[1];
			var _h = useState(null), ok = _h[0], setOk = _h[1];
			var _i = useState(null), busy = _i[0], setBusy = _i[1];
			var changes = repo ? repo.changes || [] : [];
			var staged = changes.filter(function (c) { return c.staged === true; });
			var unstaged = changes.filter(function (c) { return c.unstaged === true && c.untracked !== true; });
			var untracked = changes.filter(function (c) { return c.untracked === true; });
			var hasConflicts = changes.some(function (c) { return c.unmerged === true; });
			var refresh = useCallback(function () {
				callApi("/ext/api/git/status").then(function (value) {
					setRepo(value);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
				callApi("/ext/api/git/log?n=30").then(function (value) {
					setCommits(value.commits || []);
				}, function () { /* log failures are non-fatal */ });
			}, []);
			var loadBranches = useCallback(function () {
				callApi("/ext/api/git/branches").then(function (value) {
					setBranches(value.branches || []);
				}, function () { /* non-fatal */ });
			}, []);
			useEffect(function () {
				refresh();
				loadBranches();
				var timer = window.setInterval(refresh, GIT_POLL_MS);
				return function () { window.clearInterval(timer); };
			}, [refresh, loadBranches]);
			var loadDiff = useCallback(function (path, stagedFlag) {
				setSel({ path: path, staged: stagedFlag });
				setDiff({ loading: true, path: path, staged: stagedFlag });
				callApi("/ext/api/git/diff?path=" + encodeURIComponent(path) + "&staged=" + (stagedFlag ? "1" : "0")).then(function (value) {
					setDiff({
						loading: false,
						path: value.path,
						staged: value.staged === true,
						untracked: value.untracked === true,
						binary: value.binary === true,
						combined: value.combined === true,
						truncated: value.truncated === true,
						lines: value.lines || []
					});
				}, function (reason) {
					setDiff({ loading: false, path: path, staged: stagedFlag, failed: String(reason && reason.message ? reason.message : reason) });
				});
			}, []);
			var closeDiff = useCallback(function () {
				setSel(null);
				setDiff(null);
			}, []);
			var toggleStage = useCallback(function (change, group) {
				if (busy !== null) return;
				var unstage = group === "staged";
				setBusy("toggle");
				setError(null);
				setOk(null);
				callApi(unstage ? "/ext/api/git/unstage" : "/ext/api/git/stage", { paths: [change.path] }).then(function () {
					setBusy(null);
					setOk(unstage ? t("gitUnstageOk") : t("gitStageOk"));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, t]);
			var stageAll = useCallback(function () {
				if (busy !== null) return;
				setBusy("stage-all");
				setError(null);
				setOk(null);
				callApi("/ext/api/git/stage-all", {}).then(function () {
					setBusy(null);
					setOk(t("gitStageOk"));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, t]);
			var unstageAll = useCallback(function () {
				if (busy !== null) return;
				setBusy("unstage-all");
				setError(null);
				setOk(null);
				callApi("/ext/api/git/unstage-all", {}).then(function () {
					setBusy(null);
					setOk(t("gitUnstageOk"));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, t]);
			var commit = useCallback(function () {
				if (busy !== null || !message.trim() || staged.length === 0) return;
				setBusy("commit");
				setError(null);
				setOk(null);
				callApi("/ext/api/git/commit", { message: message.trim() }).then(function () {
					setBusy(null);
					setMessage("");
					setOk(t("gitCommitOk"));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, message, staged.length, refresh, t]);
			var discard = useCallback(function (change) {
				if (busy !== null) return;
				if (!window.confirm(t("gitDiscardConfirm") + " " + change.path)) return;
				setBusy("discard");
				setError(null);
				setOk(null);
				callApi("/ext/api/git/discard", { paths: [change.path] }).then(function () {
					setBusy(null);
					setOk(t("gitDiscardOk"));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, t]);
			var sync = useCallback(function (op) {
				if (busy !== null) return;
				setBusy(op);
				setError(null);
				setOk(null);
				callApi("/ext/api/git/" + op, {}).then(function (value) {
					setBusy(null);
					var summary = Array.isArray(value.summary) && value.summary.length > 0 ? value.summary.join(" · ") : "";
					setOk((op === "pull" ? t("gitPullOk") : t("gitPushOk")) + (summary ? " — " + summary : ""));
					refresh();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, t]);
			var checkout = useCallback(function (branch) {
				if (busy !== null) return;
				setBusy("checkout");
				setError(null);
				setOk(null);
				callApi("/ext/api/git/checkout", { branch: branch }).then(function () {
					setBusy(null);
					setOk(t("gitCheckoutOk") + branch);
					closeDiff();
					refresh();
					loadBranches();
				}, function (reason) {
					setBusy(null);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, refresh, loadBranches, closeDiff, t]);
			var canCommit = staged.length > 0 && message.trim().length > 0 && !hasConflicts && busy === null;
			var renderGroup = function (group, list) {
				var title = group === "staged" ? t("gitStaged") : group === "unstaged" ? t("gitUnstaged") : t("gitUntracked");
				var all = group === "staged" ? t("gitUnstageAll") : t("gitStageAll");
				return jsxs("div", { className: "extc-git-group", children: [
					jsxs("div", { className: "extc-git-group-head", children: [
						jsx("span", { className: "extc-git-group-title", children: title }),
						jsx("span", { className: "extc-git-group-count", children: String(list.length) }),
						jsx("button", {
							type: "button",
							className: "extc-git-ibtn",
							disabled: busy !== null || list.length === 0,
							onClick: function () { if (group === "staged") unstageAll(); else stageAll(); },
							children: all
						})
					] }),
					list.map(function (change) {
						return jsx(GitRow, {
							change: change,
							group: group,
							t: t,
							selected: sel !== null && sel.path === change.path && sel.staged === (group === "staged"),
							onOpen: function () { loadDiff(change.path, group === "staged"); },
							onToggle: function () { toggleStage(change, group); },
							onDiscard: function () { discard(change); }
						}, group + ":" + change.path);
					})
				] });
			};
			var rootName = repo && repo.root ? repo.root.split(/[\\/]/).pop() : "";
			return jsxs("div", { className: "extc-git", children: [
				error ? jsx("div", { className: "extc-error", children: error }) : null,
				ok ? jsx("div", { className: "extc-ok", children: ok }) : null,
				jsxs("div", { className: "extc-git-bar", children: [
					repo && repo.detached === true ? jsx("span", { className: "extc-git-ab", children: t("gitDetached") }) : jsx(Select, {
						value: repo ? repo.branch || "" : "",
						disabled: busy !== null || branches.length === 0,
						onChange: function (name) { if (name && name !== (repo ? repo.branch : "")) checkout(name); },
						options: branches.map(function (b) { return { value: b.name, label: (b.current ? "✓ " : "") + b.name }; })
					}),
					repo && repo.upstream ? jsx("span", { className: "extc-git-ab", title: t("gitUpstream") + " " + repo.upstream, children: t("gitUpstream") + " " + repo.upstream }) : null,
					repo && repo.ahead > 0 ? jsx("span", { className: "extc-git-ab extc-git-ab-up", title: t("gitAhead") + " " + repo.ahead, children: "↑" + repo.ahead }) : null,
					repo && repo.behind > 0 ? jsx("span", { className: "extc-git-ab extc-git-ab-down", title: t("gitBehind") + " " + repo.behind, children: "↓" + repo.behind }) : null,
					rootName ? jsx("span", { className: "extc-git-ab", title: repo.root, children: rootName }) : null,
					jsx("span", { className: "extc-git-spacer" }),
					jsx(Button, { small: true, busy: busy === "pull", disabled: busy !== null, onClick: function () { sync("pull"); }, children: t("gitPull") }),
					jsx(Button, { small: true, busy: busy === "push", disabled: busy !== null, onClick: function () { sync("push"); }, children: t("gitPush") }),
					jsx(Button, { small: true, disabled: busy !== null, onClick: refresh, children: t("gitRefresh") })
				] }),
				repo === null ? jsxs("div", { className: "extc-git-pick", children: [
					jsx("p", { className: "extc-git-note", children: error ? t("gitNoRepo") : t("gitLoading") }),
					jsx(Button, { small: true, onClick: refresh, children: t("gitRefresh") })
				] }) : jsxs("div", { className: "extc-git-main", children: [
					jsxs("div", { className: "extc-git-col", children: [
						jsxs("div", { className: "extc-git-commit-box", children: [
							jsx("textarea", {
								className: "extc-input",
								rows: 3,
								value: message,
								placeholder: t("gitCommitMsg"),
								disabled: busy !== null,
								onChange: function (event) { setMessage(event.target.value); },
								onKeyDown: function (event) {
									if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
										event.preventDefault();
										commit();
									}
								}
							}),
							jsxs("div", { className: "extc-git-commit-actions", children: [
								jsx(Button, {
									primary: true,
									busy: busy === "commit",
									disabled: !canCommit,
									onClick: commit,
									children: staged.length > 0 ? t("gitCommitN").replace("{n}", String(staged.length)) : t("gitCommit")
								}),
								hasConflicts ? jsx("span", { className: "extc-git-commit-count", children: t("gitConflictHint") }) : staged.length === 0 ? jsx("span", { className: "extc-git-commit-count", children: t("gitNoStaged") }) : null
							] })
						] }),
						changes.length === 0 ? jsx("p", { className: "extc-git-note", children: t("gitEmpty") }) : null,
						staged.length > 0 ? renderGroup("staged", staged) : null,
						unstaged.length > 0 ? renderGroup("unstaged", unstaged) : null,
						untracked.length > 0 ? renderGroup("untracked", untracked) : null,
						jsxs("div", { className: "extc-git-group", children: [
							jsxs("div", { className: "extc-git-group-head", children: [
								jsx("span", { className: "extc-git-group-title", children: t("gitHistory") }),
								jsx("span", { className: "extc-git-group-count", children: String(commits.length) })
							] }),
							commits.length === 0 ? jsx("p", { className: "extc-git-note", children: t("gitHistoryEmpty") }) : jsx("div", { className: "extc-git-log", children: commits.map(function (commitItem) {
								return jsxs("div", { className: "extc-git-log-row", title: commitItem.oid, children: [
									jsx("span", { className: "extc-git-log-subject", children: commitItem.subject }),
									jsxs("span", { className: "extc-git-log-meta", children: [
										jsx("span", { children: commitItem.short }),
										jsx("span", { children: commitItem.author }),
										jsx("span", { children: commitItem.time ? new Date(commitItem.time * 1000).toLocaleString() : "" })
									] })
								] }, commitItem.oid);
							}) })
						] })
					] }),
					jsx("section", { className: "extc-git-diff", children: diff === null ? jsx("div", { className: "extc-git-pick", children: t("gitDiffPick") }) : jsxs(Fragment, { children: [
						jsxs("header", { className: "extc-git-diff-head", children: [
							jsx("span", { className: "extc-git-diff-path", children: diff.path }),
							diff.staged ? jsx("span", { className: "extc-git-diff-tag", children: t("gitDiffStagedTag") }) : diff.untracked ? jsx("span", { className: "extc-git-diff-tag", children: t("gitDiffUntrackedTag") }) : jsx("span", { className: "extc-git-diff-tag", children: t("gitDiffWorkTag") }),
							jsx("button", {
								type: "button",
								className: "extc-git-ibtn",
								title: t("gitDiffClose"),
								"aria-label": t("gitDiffClose"),
								onClick: closeDiff,
								children: jsx(_primitives.IconCloseOutline16, { size: 14 })
							})
						] }),
						jsxs("div", { className: "extc-git-diff-body", children: [
							diff.failed ? jsx("div", { className: "extc-error", children: diff.failed }) : null,
							diff.loading ? jsx("p", { className: "extc-git-note", children: t("gitLoading") }) : null,
							!diff.loading && diff.binary ? jsx("p", { className: "extc-git-note", children: t("gitDiffBinary") }) : null,
							!diff.loading && diff.truncated ? jsx("p", { className: "extc-git-note", children: t("gitDiffTruncated") }) : null,
							!diff.loading && !diff.failed ? (diff.lines || []).map(function (line, index) {
								return jsx(GitDiffLine, { line: line }, String(index));
							}) : null
						] })
					] }) })
				] })
			] });
		}
		//#region lib/types/client/McpTab.js
		/** The MCP tab: manage custom MCP servers as live dsh-mcp-client patch rows. */
		var MCP_POLL_MS = 3000;
		/** Split a textarea into trimmed non-empty lines. */
		function mcpLines(text) {
			return String(text || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(function (line) { return line !== ""; });
		}
		/** Parse KEY=VALUE (sep "=") or Name: Value (sep ":") lines into an object. */
		function mcpKeyValues(text, sep) {
			var out = {};
			var lines = mcpLines(text);
			for (var i = 0; i < lines.length; i++) {
				var at = lines[i].indexOf(sep);
				if (at <= 0) continue;
				var key = lines[i].slice(0, at).trim();
				if (key) out[key] = lines[i].slice(at + 1).trim();
			}
			return out;
		}
		/** Phase label with a null-safe fallback (rows the loader never touched). */
		function mcpPhase(t, phase) {
			return phase ? phaseLabel(t, phase) : t("mcpPhaseNull");
		}
		/** The MCP tab: add form over the live server list with enable/remove actions. */
		function McpTab(props) {
			var t = props.t;
			var _a = useState(null), servers = _a[0], setServers = _a[1];
			var _b = useState(null), error = _b[0], setError = _b[1];
			var _c = useState(""), name = _c[0], setName = _c[1];
			var _d = useState("stdio"), transport = _d[0], setTransport = _d[1];
			var _e = useState(""), command = _e[0], setCommand = _e[1];
			var _f = useState(""), argsText = _f[0], setArgsText = _f[1];
			var _g = useState(""), envText = _g[0], setEnvText = _g[1];
			var _h = useState(""), cwd = _h[0], setCwd = _h[1];
			var _i = useState(""), url = _i[0], setUrl = _i[1];
			var _j = useState(""), headersText = _j[0], setHeadersText = _j[1];
			var _k = useState(""), timeoutText = _k[0], setTimeoutText = _k[1];
			var _l = useState(false), busy = _l[0], setBusy = _l[1];
			var _m = useState(null), message = _m[0], setMessage = _m[1];
			var load = useCallback(function () {
				callApi("/ext/api/mcp/list").then(function (value) {
					setServers(value.servers || []);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, []);
			useEffect(function () {
				load();
				var timer = window.setInterval(load, MCP_POLL_MS);
				return function () { window.clearInterval(timer); };
			}, [load]);
			var add = useCallback(function () {
				if (busy || !name.trim()) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				var payload = { name: name.trim(), transport: transport };
				if (timeoutText.trim() !== "" && Number(timeoutText.trim()) > 0) payload.toolCallTimeoutMs = Number(timeoutText.trim());
				if (transport === "stdio") {
					payload.command = command.trim();
					var args = mcpLines(argsText);
					if (args.length > 0) payload.args = args;
					var env = mcpKeyValues(envText, "=");
					if (Object.keys(env).length > 0) payload.env = env;
					payload.cwd = cwd.trim();
				} else {
					payload.url = url.trim();
					var headers = mcpKeyValues(headersText, ":");
					if (Object.keys(headers).length > 0) payload.headers = headers;
				}
				callApi("/ext/api/mcp/add", payload).then(function (value) {
					setBusy(false);
					setMessage(t("mcpAdded") + value.name);
					setName("");
					setArgsText("");
					setEnvText("");
					setHeadersText("");
					setTimeoutText("");
					load();
				}, function (reason) {
					setBusy(false);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, name, transport, command, argsText, envText, cwd, url, headersText, timeoutText, load, t]);
			var remove = useCallback(function (server) {
				if (busy) return;
				if (!window.confirm(t("mcpRemoveConfirm") + server.name + t("uninstallAsk"))) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/mcp/remove", { name: server.name }).then(function () {
					setBusy(false);
					setMessage(t("mcpRemoved") + server.name);
					load();
				}, function (reason) {
					setBusy(false);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, load, t]);
			var toggle = useCallback(function (server) {
				if (busy || !server.managed) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/mcp/set-enabled", { name: server.name, enabled: !server.enabled }).then(function () {
					setBusy(false);
					setMessage((server.enabled ? t("mcpDisableOk") : t("mcpEnableOk")) + server.name);
					load();
				}, function (reason) {
					setBusy(false);
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, load, t]);
			var list = servers || [];
			var managedCount = list.filter(function (server) { return server.managed; }).length;
			var atCap = managedCount >= 16;
			return jsxs("div", { className: "extc-panel", children: [
				jsx("p", { className: "extc-empty", children: t("mcpIntro") }),
				error ? jsx("div", { className: "extc-error", children: error }) : null,
				message ? jsx("div", { className: "extc-ok", children: message }) : null,
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("mcpAddTitle") }),
					jsx("div", { className: "extc-form", children: [
						jsx(Field, { label: t("mcpName"), hint: t("mcpNameHint"), children: jsx(TextInput, { value: name, placeholder: "my-server", disabled: busy, onChange: setName }) }),
						jsx(Field, { label: t("mcpTransport"), children: jsx(Select, { value: transport, disabled: busy, onChange: setTransport, options: [
							{ value: "stdio", label: t("mcpStdio") },
							{ value: "streamable-http", label: t("mcpHttp") }
						] }) }),
						transport === "stdio" ? jsxs(Fragment, { children: [
							jsx(Field, { label: t("mcpCommand"), hint: t("mcpCommandHint"), children: jsx(TextInput, { value: command, placeholder: "npx", disabled: busy, onChange: setCommand }) }),
							jsx(Field, { label: t("mcpArgs"), hint: t("mcpArgsHint"), children: jsx(TextArea, { value: argsText, rows: 3, disabled: busy, onChange: setArgsText }) }),
							jsx(Field, { label: t("mcpEnv"), hint: t("mcpEnvHint"), children: jsx(TextArea, { value: envText, rows: 3, disabled: busy, onChange: setEnvText }) }),
							jsx(Field, { label: t("mcpCwd"), hint: t("mcpCwdHint"), children: jsx(TextInput, { value: cwd, placeholder: "C:\\path", disabled: busy, onChange: setCwd }) })
						] }) : jsxs(Fragment, { children: [
							jsx(Field, { label: t("mcpUrl"), hint: t("mcpUrlHint"), children: jsx(TextInput, { value: url, placeholder: "http://localhost:3000/mcp", disabled: busy, onChange: setUrl }) }),
							jsx(Field, { label: t("mcpHeaders"), hint: t("mcpHeadersHint"), children: jsx(TextArea, { value: headersText, rows: 3, disabled: busy, onChange: setHeadersText }) })
						] }),
						jsx(Field, { label: t("mcpTimeout"), hint: t("mcpTimeoutHint"), children: jsx(TextInput, { value: timeoutText, placeholder: "60000", disabled: busy, onChange: setTimeoutText }) }),
						jsxs("div", { className: "extc-actions", children: [
							jsx(Button, { primary: true, busy: busy, disabled: busy || !name.trim() || atCap, onClick: add, children: t("mcpAdd") }),
							atCap ? jsx("span", { className: "extc-empty", children: t("mcpCap") }) : null
						] })
					] })
				] }),
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("mcpListTitle") }),
					servers === null ? jsx("p", { className: "extc-empty", children: t("loading") }) :
					list.length === 0 ? jsx("p", { className: "extc-empty", children: t("mcpEmpty") }) :
					jsx("ul", { className: "extc-list", children: list.map(function (server) {
						var summary = server.transport === "stdio"
							? [server.command || ""].concat(server.args || []).join(" ")
							: server.url || "";
						return jsxs("li", { className: "extc-row", children: [
							jsxs("div", { className: "extc-row-main", children: [
								jsxs("span", { className: "extc-row-title", children: [
									jsx("strong", { children: server.name }),
									jsx("span", { className: "extc-tag", children: server.transport === "streamable-http" ? t("mcpHttp") : t("mcpStdio") }),
									jsx("span", { className: "extc-tag", children: mcpPhase(t, server.fiberPhase) }),
									server.enabled ? null : jsx("span", { className: "extc-tag", children: t("mcpDisabled") }),
									server.managed ? null : jsx("span", { className: "extc-tag", children: t("mcpExternal") })
								] }),
								jsx("span", { className: "extc-row-meta", children: summary }),
								server.envKeys && server.envKeys.length > 0 ? jsx("span", { className: "extc-row-sub", children: "env: " + server.envKeys.join(", ") }) : null
							] }),
							server.managed ? jsxs("div", { className: "extc-actions", children: [
								jsx(Button, { small: true, disabled: busy, onClick: function () { toggle(server); }, children: server.enabled ? t("mcpDisable") : t("mcpEnable") }),
								jsx(Button, { small: true, danger: true, disabled: busy, onClick: function () { remove(server); }, children: t("mcpRemove") })
							] }) : null
						] }, server.name);
					}) })
				] }),
				jsx("p", { className: "extc-empty", children: t("mcpRestartNote") })
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
				{ id: "mcp", label: t("tabMcp") },
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
				tab === "mcp" ? jsx(McpTab, { t: t }) : null,
				tab === "settings" ? jsx(SettingsTab, { t: t, scope: props.scope }) : null
			] });
		}
		/** Mount the Better DeepSeek Harness settings section. */
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
			var terminalDark = function () {
				try {
					var service = (typeof ctx.get === "function" ? ctx.get("theme") : void 0) || ctx.theme;
					var snapshot = service && typeof service.getTheme === "function" ? service.getTheme() : void 0;
					var active = snapshot && snapshot.active;
					if (!active) return false;
					if (active.id === "light" || active.id === "dark") return active.colorScheme === "dark";
					return false;
				} catch (error) { return false; }
			};
			var terminalThemeSubscribe = function (listener) {
				if (typeof ctx.on === "function") return ctx.on("theme/change", listener);
				return function () { };
			};
			ctx.slots.inject("conversation.view", function () {
				return ctx.slots.register({
					name: "conversation.view",
					id: "ext-center.terminal",
					order: 20,
					label: function () { return t("tabTerminals"); },
					locale: NS,
					inject: function () { return { themeDark: terminalDark, themeSubscribe: terminalThemeSubscribe }; }
				}, TerminalTab);
			});
			ctx.slots.inject("conversation.view", function () {
				return ctx.slots.register({
					name: "conversation.view",
					id: "ext-center.git",
					order: 30,
					label: function () { return t("tabGit"); },
					locale: NS
				}, GitTab);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
