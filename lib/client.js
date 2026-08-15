window.__ModuleLoader__.load({
	id: "better-deepseek-harness",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var _react = require("react");
		var _jsx_runtime = require("react/jsx-runtime");
		var _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var useState = _react.useState, useEffect = _react.useEffect, useCallback = _react.useCallback, useRef = _react.useRef, useLayoutEffect = _react.useLayoutEffect, useSyncExternalStore = _react.useSyncExternalStore;
		var jsx = _jsx_runtime.jsx, jsxs = _jsx_runtime.jsxs, Fragment = _jsx_runtime.Fragment;
		//#region styles
		(function installStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("ext-center-styles")) return;
			var style = document.createElement("style");
			style.id = "ext-center-styles";
			style.setAttribute("data-plugin", "better-deepseek-harness");
			style.textContent = ".extc{display:flex;flex-direction:column;gap:14px;padding:2px 0 10px}\n.extc-panel{display:flex;flex-direction:column;gap:16px}\n.extc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:nowrap}\n.extc-header-main{flex:1;min-width:0}\n.extc-title{margin:0 0 4px;font-size:1.15rem;font-weight:600}\n.extc-intro{margin:0;font-size:.85rem;opacity:.75;line-height:1.5;max-width:72ch}\n.extc-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(128,128,128,.35)}\n.extc-tab{appearance:none;background:transparent;border:none;padding:8px 14px;cursor:pointer;font-size:.9rem;color:inherit;opacity:.7;border-bottom:2px solid transparent;white-space:nowrap;writing-mode:horizontal-tb}\n.extc-tab:hover{opacity:1}\n.extc-tab-active{opacity:1;border-bottom-color:currentColor;font-weight:600}\n.extc-card{border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:14px 16px;background:rgba(128,128,128,.05);display:flex;flex-direction:column;gap:12px}\n.extc-card-title{margin:0 0 4px;font-size:.95rem;font-weight:600}\n.extc-empty{margin:0;font-size:.85rem;opacity:.7;line-height:1.5}\n.extc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}\n.extc-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(128,128,128,.22);border-radius:6px;background:rgba(128,128,128,.04)}\n.extc-row-flat{border-style:dashed}\n.extc-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n.extc-row-title{font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.extc-row-sub{font-size:.8rem;opacity:.75;line-height:1.4}\n.extc-row-meta{font-size:.75rem;opacity:.55;font-family:ui-monospace,Consolas,monospace;word-break:break-all}\n.extc-tag{font-size:.65rem;padding:1px 6px;border-radius:99px;border:1px solid rgba(128,128,128,.4);opacity:.8}\n.extc-form{display:flex;flex-direction:column;gap:20px}\n.extc-field{display:flex;flex-direction:column;gap:7px}\n.extc-field-label{font-size:.82rem;font-weight:500;display:flex;flex-direction:column;gap:2px}\n.extc-field-hint{font-size:.72rem;opacity:.6;font-weight:400}\n.extc-input{font:inherit;font-size:.85rem;padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;width:100%;box-sizing:border-box}\n.extc-textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:.8rem}\n.extc-check{display:flex;align-items:center;gap:8px;font-size:.85rem}\n.extc-keyrow{display:flex;align-items:center;gap:8px}\n.extc-keyrow .extc-input{flex:1;min-width:0}\n.extc-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.extc-btn{font:inherit;font-size:.82rem;padding:6px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;cursor:pointer;white-space:nowrap;flex:none;writing-mode:horizontal-tb}\n.extc-btn:hover{background:rgba(128,128,128,.12)}\n.extc-btn:disabled{opacity:.45;cursor:default}\n.extc-btn-primary{background:rgba(64,128,255,.16);border-color:rgba(64,128,255,.5);font-weight:600}\n.extc-btn-danger{border-color:rgba(255,80,80,.5);color:#e05c5c}\n.extc-btn-small{padding:3px 8px;font-size:.75rem}\n.extc-status{display:flex;flex-direction:column;gap:4px;font-size:.82rem}\n.extc-error{color:#e05c5c;font-size:.82rem;margin:0;line-height:1.4}\n.extc-ok{color:#3fae6a;font-size:.82rem;margin:0;line-height:1.4}\n.extc-tlayer{flex:none;position:relative;width:100%;height:49px;margin:4px 0 0;display:flex;align-items:center}\n.extc-trigger{width:100%;height:49px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;opacity:.85}\n.extc-trigger:hover,.extc-trigger-open{background:rgba(128,128,128,.12);opacity:1}\n.extc-trigger-rail{width:36px;height:36px;border-radius:50%;justify-content:center;gap:0;padding:0}\n.extc-trigger-label{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tpanel{z-index:30;border:1px solid rgba(128,128,128,.3);background:var(--dsw-alias-bg-base,rgba(24,24,27,.98));width:380px;max-width:calc(100vw - 24px);max-height:60vh;border-radius:12px;flex-direction:column;display:flex;position:fixed;bottom:128px;left:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}\n.extc-theader{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.25)}\n.extc-ttitle{font-size:13px;font-weight:500;line-height:20px;min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-ticon{width:28px;height:28px;border:none;background:0 0;border-radius:50%;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:.8}\n.extc-ticon:hover{background:rgba(128,128,128,.15)}\n.extc-tbody{flex:1;min-height:0;padding:6px 8px 10px;overflow-y:auto;overscroll-behavior:contain}\n.extc-tlist{margin:0;padding:0;list-style:none}\n.extc-tnode{margin:0;padding:0;position:relative;display:flex;flex-wrap:wrap;align-items:center}\n.extc-trow{width:auto;flex:1;min-width:0;border:none;background:0 0;color:inherit;font-family:inherit;font-size:13px;line-height:24px;display:flex;align-items:center;gap:4px;cursor:pointer;border-radius:6px;text-align:left;padding-right:8px}\n.extc-trow:hover{background:rgba(128,128,128,.1)}\n.extc-tcaret{flex:none;opacity:.6;transition:transform .12s ease}\n.extc-tcaret-open{transform:rotate(90deg)}\n.extc-tname{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-tdot{flex:none;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.45;margin:0 5px}\n.extc-tmeta{margin-left:auto;flex:none;font-size:11px;opacity:.55;padding-left:8px}\n.extc-tcopied{opacity:.9}\n.extc-tempty{font-size:12px;opacity:.6;padding:2px 0 2px 26px;line-height:20px}\n.extc-terr{font-size:12px;line-height:18px;color:#e05c5c;padding:4px 8px}\n.extc-tnote{font-size:12px;opacity:.6;padding:6px 8px;margin:0;line-height:18px}\n.extc-tretry{margin-left:8px;border:none;background:0 0;color:inherit;cursor:pointer;text-decoration:underline;font-size:12px;padding:0}\n.extc-theader-actions{display:flex;align-items:center;gap:2px}\n.extc-ticon:disabled{opacity:.35;cursor:default}\n.extc-tkids{width:100%}\n.extc-tcopy{flex:none;width:22px;height:22px;border:none;background:0 0;border-radius:4px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .1s ease}\n.extc-tnode:hover .extc-tcopy,.extc-tcopy:focus-visible{opacity:.75}\n.extc-tcopy:hover{opacity:1;background:rgba(128,128,128,.15)}\n.extc-modal-dialog{width:min(1024px,94vw);max-width:94vw}\n.extc-editor{display:flex;flex-direction:column;gap:8px;min-width:420px}\n.extc-editor .extc-textarea{width:100%;aspect-ratio:16/9;min-height:260px;max-height:75vh;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:.8rem;line-height:1.5;resize:none}\n.extc-term{display:flex;flex-direction:column;gap:8px;min-height:340px;color:var(--dsw-static-neutral-bluish-950,rgb(21,21,23))}\n.extc-term-panel{flex:1;min-height:320px;display:flex;flex-direction:column;background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255));border:1px solid rgba(0,0,0,.14);border-radius:6px;overflow:hidden}\n.extc-term-bar{flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px 0;border-bottom:1px solid rgba(0,0,0,.12);background:var(--dsw-static-neutral-bluish-50,rgb(249,250,251))}\n.extc-term-tabs{margin:0;padding:0;list-style:none;display:flex;align-items:stretch;gap:2px;min-width:0;flex:1;overflow-x:auto;scrollbar-width:none}\n.extc-term-tabs::-webkit-scrollbar{display:none}\n.extc-term-tab{position:relative;display:flex;align-items:center;gap:4px;margin-bottom:-1px;border-radius:6px 6px 0 0;background:rgba(0,0,0,.05);border:1px solid rgba(0,0,0,.1);border-bottom-color:transparent;padding:0 6px 0 10px;min-width:0;max-width:220px}\n.extc-term-tab:hover{background:rgba(0,0,0,.09)}\n.extc-term-tab-active{background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255));border-color:rgba(0,0,0,.14);border-bottom-color:transparent}\n.extc-term-tab-active::before{content:'';position:absolute;top:0;left:4px;right:4px;height:2px;background:#0969da;border-radius:2px}\n.extc-term-tab-sel{flex:1;min-width:0;display:inline-flex;align-items:center;gap:6px;border:none;background:0 0;color:inherit;font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;padding:5px 0;cursor:pointer;text-align:left}\n.extc-term-tab-name{min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-term-dot{flex:none;width:7px;height:7px;border-radius:50%;background:#3fae6a}\n.extc-term-dot-dead{background:#9a9aa0}\n.extc-term-tab-close{flex:none;width:18px;height:18px;border:none;background:0 0;border-radius:3px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .1s ease}\n.extc-term-tab:hover .extc-term-tab-close,.extc-term-tab-active .extc-term-tab-close,.extc-term-tab-close:focus-visible{opacity:.65}\n.extc-term-tab-close:hover{opacity:1;background:rgba(0,0,0,.1)}\n.extc-term-add{flex:none;border:none;background:0 0;color:inherit;font:inherit;font-size:.75rem;padding:4px 8px;border-radius:4px;cursor:pointer;opacity:.8;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}\n.extc-term-add:hover{background:rgba(0,0,0,.08);opacity:1}\n.extc-term-add:disabled{opacity:.35;cursor:default}\n.extc-term-count{flex:none;font-size:.72rem;opacity:.6;white-space:nowrap;padding:0 4px}\n.extc-term-out{flex:1;min-height:280px;max-height:60vh;overflow:auto;margin:0;padding:10px 14px;background:0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Cascadia Mono','Microsoft YaHei UI',monospace;font-size:.8rem;line-height:1.5;white-space:pre-wrap;word-break:break-all;tab-size:4;color:inherit}\n.extc-term-out::-webkit-scrollbar{width:10px;height:10px}\n.extc-term-out::-webkit-scrollbar-thumb{background:rgba(0,0,0,.25);border-radius:5px;border:2px solid transparent;background-clip:content-box}\n.extc-term-out::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.4);border:2px solid transparent;background-clip:content-box}\n.extc-term-in{flex:none;display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid rgba(0,0,0,.1);background:var(--dsw-static-neutral-bluish-00,rgb(255,255,255))}\n.extc-term-prompt{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;font-weight:600;opacity:.55;user-select:none}\n.extc-term-in .extc-input{flex:1;border:none;background:0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;padding:4px 2px;box-shadow:none}\n.extc-term-in .extc-input:focus{outline:none}\n.extc-term-empty{margin:auto 0;align-self:center;text-align:center;padding:18px 26px;border:1px dashed rgba(0,0,0,.28);border-radius:8px;background:#fff;color:rgba(0,0,0,.85);box-shadow:0 2px 10px rgba(0,0,0,.3);font-size:1.05rem;line-height:1.6}\n.extc-term-dark{color:var(--dsw-static-neutral-bluish-50,rgb(250,250,250))}\n.extc-term-dark .extc-term-panel{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-color:rgba(255,255,255,.14)}\n.extc-term-dark .extc-term-bar{background:rgba(255,255,255,.04);border-bottom-color:rgba(255,255,255,.14)}\n.extc-term-dark .extc-term-tab{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}\n.extc-term-dark .extc-term-tab:hover{background:rgba(255,255,255,.1)}\n.extc-term-dark .extc-term-tab-active{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-color:rgba(255,255,255,.16)}\n.extc-term-dark .extc-term-tab-active::before{background:#4b9bff}\n.extc-term-dark .extc-term-tab-close:hover{background:rgba(255,255,255,.16)}\n.extc-term-dark .extc-term-add:hover{background:rgba(255,255,255,.12)}\n.extc-term-dark .extc-term-in{background:var(--dsw-static-neutral-bluish-950,rgb(21,21,23));border-top-color:rgba(255,255,255,.12)}\n.extc-term-dark .extc-term-out::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3)}\n.extc-term-dark .extc-term-out::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.5)}\n@media (max-width:760px){.extc-term{min-height:280px}.extc-term-panel{min-height:260px}.extc-term-out{min-height:220px}}\n.extc-git{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow:hidden;padding:2px 0 0}\n.extc-git-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0 8px;border-bottom:1px solid rgba(128,128,128,.22)}\n.extc-git-bar .extc-input{min-width:150px;max-width:230px;font-size:.82rem;padding:4px 8px}\n.extc-git-ab{font-family:ui-monospace,Consolas,monospace;font-size:.75rem;opacity:.8;white-space:nowrap}\n.extc-git-ab-up{color:#2da44e}\n.extc-git-ab-down{color:#f85149}\n.extc-git-spacer{flex:1}\n.extc-git-main{display:flex;gap:10px;flex:1;min-height:0}\n.extc-git-col{display:flex;flex-direction:column;gap:10px;flex:0 0 320px;min-width:0;overflow-y:auto;padding-right:4px}\n.extc-git-commit-box{display:flex;flex-direction:column;gap:8px;border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:10px;background:rgba(128,128,128,.05)}\n.extc-git-commit-box .extc-input{width:100%;box-sizing:border-box;resize:vertical;min-height:60px}\n.extc-git-commit-actions{display:flex;align-items:center;gap:10px}\n.extc-git-commit-count{font-size:.75rem;opacity:.65}\n.extc-git-group{display:flex;flex-direction:column;gap:2px}\n.extc-git-group-head{display:flex;align-items:center;gap:8px;padding:6px 2px 2px}\n.extc-git-group-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;opacity:.85;flex:1;min-width:0}\n.extc-git-group-count{font-size:.72rem;opacity:.6}\n.extc-git-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent}\n.extc-git-row:hover{background:rgba(128,128,128,.1)}\n.extc-git-row-sel{background:rgba(56,139,253,.14);border-color:rgba(56,139,253,.45)}\n.extc-git-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}\n.extc-git-row-name{font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.extc-git-row-dir{font-size:.7rem;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,Consolas,monospace}\n.extc-git-row-sub{font-size:.7rem;opacity:.55}\n.extc-git-badge{flex:none;width:15px;height:15px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff}\n.extc-git-badge-mod{background:#d29922}\n.extc-git-badge-add{background:#2da44e}\n.extc-git-badge-del{background:#f85149}\n.extc-git-badge-ren{background:#a371f7}\n.extc-git-row-actions{flex:none;display:flex;gap:2px;opacity:0}\n.extc-git-row:hover .extc-git-row-actions{opacity:1}\n.extc-git-ibtn{appearance:none;background:transparent;border:1px solid transparent;border-radius:5px;color:inherit;cursor:pointer;font-size:.85rem;line-height:1;padding:3px 6px;opacity:.75;white-space:nowrap}\n.extc-git-ibtn:hover{opacity:1;background:rgba(128,128,128,.16)}\n.extc-git-ibtn-danger:hover{color:#f85149}\n.extc-git-diff{flex:1;min-width:0;display:flex;flex-direction:column;border:1px solid rgba(128,128,128,.22);border-radius:8px;overflow:hidden;background:rgba(128,128,128,.04)}\n.extc-git-diff-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.22);flex-wrap:wrap}\n.extc-git-diff-path{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;flex:1;min-width:0;word-break:break-all}\n.extc-git-diff-tag{font-size:.68rem;padding:1px 8px;border-radius:99px;border:1px solid rgba(128,128,128,.4);opacity:.85;white-space:nowrap}\n.extc-git-diff-body{flex:1;overflow:auto;padding:8px 0}\n.extc-gd-line{display:flex;align-items:baseline;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.76rem;line-height:1.55;white-space:pre-wrap;word-break:break-all;tab-size:4}\n.extc-gd-no{flex:none;width:46px;padding-right:10px;text-align:right;opacity:.45;user-select:none}\n.extc-gd-text{flex:1;min-width:0;padding:0 12px 0 4px}\n.extc-gd-add{background:rgba(46,160,67,.14)}\n.extc-gd-add .extc-gd-text{color:rgba(63,185,80,.92)}\n.extc-gd-del{background:rgba(248,81,73,.13)}\n.extc-gd-del .extc-gd-text{color:rgba(255,123,114,.92)}\n.extc-gd-hunk{background:rgba(56,139,253,.14);font-weight:600}\n.extc-gd-hunk .extc-gd-text{color:rgba(88,166,255,.95)}\n.extc-gd-meta{opacity:.55}\n.extc-gd-raw{opacity:.85}\n.extc-git-log{display:flex;flex-direction:column;gap:2px}\n.extc-git-log-row{display:flex;flex-direction:column;gap:1px;padding:5px 6px;border-radius:6px}\n.extc-git-log-row:hover{background:rgba(128,128,128,.08)}\n.extc-git-log-subject{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.extc-git-log-meta{font-size:.68rem;opacity:.55;display:flex;gap:8px}\n.extc-git-note{margin:0;font-size:.82rem;opacity:.7;line-height:1.5;padding:8px 10px;border:1px dashed rgba(128,128,128,.35);border-radius:8px}\n.extc-git-pick{display:flex;align-items:center;justify-content:center;flex:1;font-size:.85rem;opacity:.6;padding:40px 16px;text-align:center}\n@media (max-width:880px){.extc-git-main{flex-direction:column;overflow-y:auto}.extc-git-col{flex:none;overflow:visible}.extc-git-diff{min-height:320px;flex:none}}.extc-optimize-error{font-size:.7rem;color:rgba(255,123,114,.9);margin-right:6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.extc-optimize-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid rgba(128,128,128,.35);border-radius:6px;background:transparent;color:inherit;cursor:pointer;opacity:.85;flex:none}.extc-optimize-btn:hover:not(:disabled){opacity:1;background:rgba(128,128,128,.1)}.extc-optimize-btn:disabled{opacity:.4;cursor:default}.extc-optimize-spinner{font-size:.85rem;line-height:1}.extc-optimize-anchor{display:none}\n.extc-alayer{flex:none;position:relative;width:100%;height:49px;margin:12px 0 0;display:flex;align-items:center}\n:has(> [data-slot='sidebar.footer.action'] > .extc-alayer):has(> [data-slot='sidebar.footer.action'] > .extc-tlayer){flex-direction:column;align-items:stretch}\n.extc-apanel{z-index:30;border:1px solid rgba(128,128,128,.22);background:var(--dsw-alias-bg-base,rgba(24,24,27,.98));width:min(400px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:min(520px,calc(100vh - 200px));border-radius:16px;flex-direction:column;display:flex;position:fixed;bottom:176px;left:12px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.12)}\n.extc-aheader{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:14px 16px;border-bottom:1px solid rgba(128,128,128,.2)}\n.extc-atitle{font-size:14px;font-weight:600;line-height:22px;letter-spacing:.01em;min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n.extc-acount{flex:none;font-size:11px;font-weight:600;line-height:18px;padding:0 8px;border-radius:999px;background:rgba(128,128,128,.12);color:inherit;opacity:.85;font-variant-numeric:tabular-nums}\n.extc-abody{display:flex;flex-direction:column;gap:10px;min-height:0;overflow-y:auto;padding:12px 14px}\n.extc-atoolbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px}\n.extc-alist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}\n.extc-arow{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid rgba(128,128,128,.18);border-radius:12px;background:rgba(128,128,128,.045);transition:background .15s ease,border-color .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.04)}\n.extc-arow-checked{background:rgba(64,128,255,.08);border-color:rgba(64,128,255,.42)}\n.extc-arow:hover{background:rgba(128,128,128,.08);border-color:rgba(128,128,128,.3)}\n.extc-arow-checked:hover{background:rgba(64,128,255,.12);border-color:rgba(64,128,255,.5)}\n.extc-arow .extc-row-main{gap:4px}\n.extc-arow .extc-row-title{font-size:.92rem;font-weight:600;line-height:1.45;letter-spacing:.01em;color:inherit}\n.extc-arow .extc-row-sub{display:block;font-size:.8rem;line-height:1.55;opacity:.72;word-break:break-word;overflow-wrap:anywhere}\n.extc-arow > .extc-check{flex:none;margin-top:3px}\n.extc-apanel .extc-empty{padding:28px 16px;text-align:center;font-size:.85rem;line-height:1.6;opacity:.65}\n@media (max-width:480px){.extc-apanel{width:calc(100vw - 16px);left:8px;bottom:160px;border-radius:14px}.extc-aheader{padding:12px 14px}.extc-abody{padding:10px 12px}.extc-arow{padding:10px 12px;gap:10px}}\n.extc-card-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px}\n.extc-card-title-row .extc-card-title{margin:0}\n.extc-rescue-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;max-height:44vh;overflow:auto}\n.extc-rescue-note{margin:0;font-size:.8rem;opacity:.7;line-height:1.5}\n.extc-rescue-reason{font-size:.78rem;opacity:.8;line-height:1.45;word-break:break-word}";
			document.head.appendChild(style);
		})();
		//#endregion
		//#region lib/types/client/locales.js
		/** Simplified Chinese dictionary (key source of truth). */
		var zh = {
			nav: "更好的 DeepSeek Harness",
			title: "更好的 DeepSeek Harness",
			intro: "从 Web UI 安装和管理技能（Skills）与插件（Plugins）。安装的插件通过 cordis.patch.yml 热生效，无需重启；带界面的插件在刷新页面后出现。",
			tabSkills: "技能",
			tabPlugins: "插件",
			tabSettings: "设置",
			loading: "正在读取…",
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
			pluginInstallBuilt: "（仓库未提交构建产物，已自动执行 npm install 并构建）",
			pluginRemoveOk: "插件已卸载：",
			pluginRemoveConfirm: "确定卸载插件 ",
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
			allowLan: "允许局域网访问",
			allowLanHint: "开启后，局域网内的浏览器也能通过 /ext/api 读写插件功能（安装/卸载/停用、文件树、终端输出与 Git/MCP 读取）。默认仅限本机（回环地址）。",
			skillRoot: "技能根目录",
			skillRootHint: "安装技能的目标目录；留空使用 ~/.dsh/skills。",
			customSkillDirs: "额外技能目录",
			customSkillDirsHint: "每行一个目录；这些目录中的技能会提供给所有会话。",
			save: "保存",
			saved: "已保存",
			reset: "重置",
			readOnly: "本部署的设置只读。",
			noop: "没有变化。",
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
			treeTruncated: "（仅显示前 {n} 项）",
			treeCopyPath: "复制路径",
			tabTerminals: "终端",
			termCmd: "CMD",
			termPowerShell: "PowerShell",
			termEmpty: "还没有终端，选择 CMD 或 PowerShell 新建一个。",
			termInput: "输入命令，回车发送…",
			termSend: "发送",
			termInterrupt: "中断 (Ctrl+C)",
			termKill: "关闭终端",
			termCap: "终端数量已达上限（{n} 个）",
			tabGit: "Git",
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
			mcpEnvInvalid: "环境变量必须为每行 KEY=VALUE 格式。",
			mcpCwd: "工作目录",
			mcpCwdHint: "留空使用启动目录",
			mcpUrl: "服务器 URL",
			mcpUrlHint: "如 http://localhost:3000/mcp",
			mcpHeaders: "请求头（每行 名称: 值）",
			mcpHeadersHint: "例如 Authorization: Bearer token",
			mcpHeadersInvalid: "请求头必须为每行 名称: 值 格式。",
			mcpTimeout: "工具调用超时（毫秒）",
			mcpTimeoutHint: "留空使用默认 60000；允许 1000-600000",
			mcpTimeoutInvalid: "工具调用超时必须是 1000-600000 之间的整数。",
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
			mcpCap: "MCP 服务器数量已达上限（{n} 个）",
			mcpPhaseNull: "未加载",
			mcpDisabled: "已停用",
			visionTitle: "图片转述",
			visionIntro: "当会话模型不支持图片时，先用下面的视觉模型把图片转述成文字，再交给主模型。启用后，含图片的请求会自动转述；会话记录中的原始图片不受影响。",
			visionEnabled: "启用图片转述",
			visionProvider: "转述模型提供方",
			visionProviderHint: "从已注册的提供方路由中选择；选择「自定义路由」后直接填写 OpenAI 兼容 API 地址",
			visionProviderCustom: "自定义路由",
			visionModel: "转述模型",
			visionModelHint: "必须是支持图片输入的多模态模型",
			visionPrompt: "转述提示词",
			visionPromptHint: "发给视觉模型的指令；留空使用内置提示词",
			visionApiUrl: "自定义 API URL",
			visionApiUrlHint: "OpenAI 兼容的 chat/completions 地址；例如 https://api.example.com/v1/chat/completions",
			visionApiKey: "API Key",
			visionApiKeyHint: "OpenAI 兼容端点的密钥；留空保持不变",
			visionApiKeyPlaceholder: "输入新密钥…",
			visionApiKeySet: "已配置",
			visionApiKeyUnset: "未配置",
			visionMaxImages: "单次转述图片上限",
			visionMaxImagesHint: "1-{n}；超出部分以占位文本代替",
			visionMaxTokens: "转述输出上限（tokens）",
			visionMaxTokensHint: "64-8192；留空使用部署默认值",
			visionNote: "转述在模型调用前发生（llm/stream 包装），仅替换本次请求中的图片块。",
			visionCustom: "（自定义）",
			tabTavily: "Tavily",
			tavilyTitle: "Tavily 搜索",
			tavilyIntro: "将 Tavily 搜索接入 DeepSeek 问答：模型需要实时信息或无法自信回答时，会自动调用 tavily_search 工具，并把搜索结果注入上下文供参考。配置保存在 settings.yaml 的 ext-center 节。",
			tavilyEnabled: "启用 Tavily 搜索",
			tavilyApiKey: "API Key",
			tavilyApiKeyHint: "必填（启用时）。以 tvly- 开头；留空表示保留已保存的密钥",
			tavilyApiKeyPlaceholder: "输入新密钥…",
			tavilyApiKeySet: "已配置",
			tavilyApiKeyUnset: "未配置",
			tavilyShowKey: "显示",
			tavilyHideKey: "隐藏",
			tavilySearchDepth: "搜索深度（Search Depth）",
			tavilySearchDepthHint: "基础更快更省；高级更全面",
			tavilyDepthBasic: "基础（basic）",
			tavilyDepthAdvanced: "高级（advanced）",
			tavilyMaxResults: "最大结果数（Max Results）",
			tavilyMaxResultsHint: "1-10；默认 5",
			tavilyIncludeRaw: "包含原始内容（Include Raw Content）",
			tavilyIncludeRawHint: "开启后返回网页原始内容（每个来源截断到 4000 字符）",
			tavilyNote: "模型在需要实时信息（新闻、价格、最新事件）或无法确定答案时使用搜索；搜索被禁用或失败不会阻塞回答——模型会直接基于已有知识作答。",
			tavilyKeyInvalid: "API Key 格式不正确：应以 tvly- 开头且至少 20 个字符。",
			tavilyKeyRequired: "启用 Tavily 搜索需要先填写 API Key（或先关闭启用开关再保存）。",
			tavilyMaxResultsInvalid: "最大结果数必须是 1-10 之间的整数。",
			tabGithub: "GitHub",
			githubTitle: "GitHub 仓库访问",
			githubIntro: "通过 GitHub REST API 访问仓库：模型可以查询仓库元数据（github_repo）、列目录（github_tree）、读文件（github_file）、搜索仓库（github_search）、查看发布（github_releases）。公开仓库无需 Token。配置保存在 settings.yaml 的 ext-center 节。",
			githubEnabled: "启用 GitHub 工具",
			githubToken: "Token（可选）",
			githubTokenHint: "访问公开仓库可留空；需要更高速率或私有仓库时填写 Personal Access Token（ghp_ 或 github_pat_ 开头）；留空表示保留已保存的 Token",
			githubTokenPlaceholder: "输入新 Token…",
			githubTokenSet: "已配置",
			githubTokenUnset: "未配置",
			githubShowKey: "显示",
			githubHideKey: "隐藏",
			githubNote: "未认证访问公开仓库的速率限制为 60 次/小时/IP；配置 Token 后提升到 5000 次/小时。",
			githubKeyInvalid: "Token 格式不正确：应以 ghp_ / gho_ / ghu_ / ghs_ / ghr_ / github_pat_ 开头且至少 20 个字符。",
			optimizeTitle: "优化输入",
			optimizeNoModel: "当前模型不可用，请先选择模型",
			archiveTrigger: "归档",
			archiveTriggerAria: "查看已归档的对话",
			archivePanelTitle: "已归档对话",
			archiveEmpty: "还没有已归档的对话。",
			archiveSelectAll: "全选",
			archiveDelete: "删除",
			archiveDeleteConfirm: "确定永久删除选中的 {n} 个已归档对话？此操作不可恢复。",
			archiveDeleteOk: "已删除 {n} 个对话",
			archiveDeleteSkipped: "有 {n} 个仍在运行/加载中的会话未删除",
			archiveNoWorkspace: "（无工作区）",
			archiveLoading: "正在读取…",
			rescueTitle: "急救模式",
			rescueIntro: "检测到 DeepSeek Harness 启动异常，已自动进入急救模式：除本插件外的第三方插件已被全部禁用，当前以最小化配置运行。请选择要重新启用的插件。",
			rescueFailure: "原因",
			rescueReasonCrash: "上次启动未完成（疑似插件冲突或第三方插件加载失败），已自动禁用",
			rescueReasonLoadFailed: "启动时加载失败（可能未构建、依赖缺失或初始化报错）",
			rescueReasonDuplicateIds: "存在重复的加载器条目 id（疑似插件冲突）",
			rescueReasonManual: "手动进入急救模式时禁用",
			rescueReasonBundle: "第三方 profile 捆绑包（dsh.profile.bundles）",
			rescueRestoreAll: "全部恢复",
			rescueKeepDisabled: "保持禁用",
			rescueApplySelected: "启用所选并重新加载",
			rescueApplying: "正在应用并重新加载…",
			rescueReloadPage: "配置已应用，页面即将自动刷新…",
			rescueReloadProcess: "配置已应用，宿主进程正在重启…",
			rescueEmpty: "没有可恢复的第三方插件。",
			rescueDismiss: "稍后处理",
			rescueManualTrigger: "进入急救模式",
			rescueManualHint: "立即禁用除本插件外的所有第三方插件，以最小化配置重新加载（用于手动恢复启动异常）",
			rescueTriggerOk: "已进入急救模式：禁用了 {n} 个第三方插件"
		};
		/** English dictionary checked against the Chinese key set. */
		var en = {
			nav: "Better DeepSeek Harness",
			title: "Better DeepSeek Harness",
			intro: "Install and manage skills and plugins from the Web UI. Installed plugins take effect live through cordis.patch.yml — no restart needed; a plugin's own UI appears after a page refresh.",
			tabSkills: "Skills",
			tabPlugins: "Plugins",
			tabSettings: "Settings",
			loading: "Loading…",
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
			pluginInstallBuilt: " (the repo ships no built output — npm install + build ran automatically)",
			pluginRemoveOk: "Plugin removed: ",
			pluginRemoveConfirm: "Uninstall plugin ",
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
			allowLan: "Allow LAN access",
			allowLanHint: "When enabled, browsers on the LAN can also read and write plugin features through /ext/api (install/uninstall/disable, file tree, terminal output, and Git/MCP reads). Off by default: loopback only.",
			skillRoot: "Skill root",
			skillRootHint: "Where new skills are installed; leave empty for ~/.dsh/skills.",
			customSkillDirs: "Extra skill directories",
			customSkillDirsHint: "One directory per line; skills in these directories are offered to every session.",
			save: "Save",
			saved: "Saved",
			reset: "Reset",
			readOnly: "This deployment stores settings read-only.",
			noop: "Nothing to change.",
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
			treeTruncated: "(showing first {n} entries)",
			treeCopyPath: "Copy path",
			tabTerminals: "Terminals",
			termCmd: "CMD",
			termPowerShell: "PowerShell",
			termEmpty: "No terminals yet — pick CMD or PowerShell to start one.",
			termInput: "Type a command and press Enter…",
			termSend: "Send",
			termInterrupt: "Interrupt (Ctrl+C)",
			termKill: "Close terminal",
			termCap: "Terminal limit reached ({n})",
			tabGit: "Git",
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
			mcpEnvInvalid: "Environment entries must use KEY=VALUE per line.",
			mcpCwd: "Working directory",
			mcpCwdHint: "Leave empty for the launch directory",
			mcpUrl: "Server URL",
			mcpUrlHint: "e.g. http://localhost:3000/mcp",
			mcpHeaders: "Headers (Name: Value per line)",
			mcpHeadersHint: "e.g. Authorization: Bearer token",
			mcpHeadersInvalid: "Headers must use Name: Value per line.",
			mcpTimeout: "Tool call timeout (ms)",
			mcpTimeoutHint: "Leave empty for the 60000 default; allowed range 1000-600000",
			mcpTimeoutInvalid: "Tool call timeout must be an integer between 1000 and 600000.",
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
			mcpCap: "MCP server limit reached ({n})",
			mcpPhaseNull: "Not loaded",
			mcpDisabled: "Disabled",
			visionTitle: "Image transcription",
			visionIntro: "When the session model cannot see images, describe them with the vision model below before the main model reads them. Once enabled, requests carrying images are transcribed automatically; the original images in the session log are untouched.",
			visionEnabled: "Enable image transcription",
			visionProvider: "Transcription provider",
			visionProviderHint: "Pick a registered provider route, or choose Custom endpoint and enter an OpenAI-compatible API URL",
			visionProviderCustom: "Custom endpoint",
			visionModel: "Transcription model",
			visionModelHint: "Must be a multimodal model that accepts image input",
			visionPrompt: "Transcription prompt",
			visionPromptHint: "Instruction sent to the vision model; empty uses the built-in prompt",
			visionApiUrl: "Custom API URL",
			visionApiUrlHint: "OpenAI-compatible chat/completions URL, e.g. https://api.example.com/v1/chat/completions",
			visionApiKey: "API Key",
			visionApiKeyHint: "Key for the OpenAI-compatible endpoint; leave empty to keep the stored one",
			visionApiKeyPlaceholder: "Enter a new key…",
			visionApiKeySet: "Configured",
			visionApiKeyUnset: "Not configured",
			visionMaxImages: "Max images per request",
			visionMaxImagesHint: "1-{n}; extra images become placeholder text",
			visionMaxTokens: "Transcription output limit (tokens)",
			visionMaxTokensHint: "64-8192; leave empty for the deployment default",
			visionNote: "Transcription wraps llm/stream and only rewrites the image blocks of the current request.",
			visionCustom: "(custom)",
			tabTavily: "Tavily",
			tavilyTitle: "Tavily search",
			tavilyIntro: "Wire Tavily search into DeepSeek Q&A: when the model needs real-time information or cannot answer confidently, it automatically calls the tavily_search tool and the results are injected into the conversation. Stored in the ext-center section of settings.yaml.",
			tavilyEnabled: "Enable Tavily search",
			tavilyApiKey: "API Key",
			tavilyApiKeyHint: "Required (when enabled). Starts with tvly-; leave empty to keep the stored key",
			tavilyApiKeyPlaceholder: "Enter a new key…",
			tavilyApiKeySet: "Configured",
			tavilyApiKeyUnset: "Not configured",
			tavilyShowKey: "Show",
			tavilyHideKey: "Hide",
			tavilySearchDepth: "Search depth",
			tavilySearchDepthHint: "basic is faster and cheaper; advanced is more thorough",
			tavilyDepthBasic: "Basic",
			tavilyDepthAdvanced: "Advanced",
			tavilyMaxResults: "Max results",
			tavilyMaxResultsHint: "1-10; default 5",
			tavilyIncludeRaw: "Include raw content",
			tavilyIncludeRawHint: "Return each page's raw content (capped at 4000 chars per source)",
			tavilyNote: "The model searches when it needs current information (news, prices, recent events) or cannot answer confidently; a disabled or failed search never blocks an answer — the model falls back to its own knowledge.",
			tavilyKeyInvalid: "Invalid API key format: must start with tvly- and be at least 20 characters.",
			tavilyKeyRequired: "An API key is required to enable Tavily search (or turn the switch off first).",
			tavilyMaxResultsInvalid: "Max results must be an integer between 1 and 10.",
			tabGithub: "GitHub",
			githubTitle: "GitHub repository access",
			githubIntro: "Query GitHub repositories through the GitHub REST API: metadata (github_repo), directory listings (github_tree), file contents (github_file), repository search (github_search), and releases (github_releases). Public repositories need no token. Stored in the ext-center section of settings.yaml.",
			githubEnabled: "Enable GitHub tools",
			githubToken: "Token (optional)",
			githubTokenHint: "Leave empty for public repositories; set a Personal Access Token (ghp_ or github_pat_) for higher rate limits or private repositories; empty keeps the stored token",
			githubTokenPlaceholder: "Enter a new token…",
			githubTokenSet: "Configured",
			githubTokenUnset: "Not configured",
			githubShowKey: "Show",
			githubHideKey: "Hide",
			githubNote: "Unauthenticated public access is limited to 60 requests/hour/IP; a token raises it to 5000/hour.",
			githubKeyInvalid: "Invalid token format: must start with ghp_ / gho_ / ghu_ / ghs_ / ghr_ / github_pat_ and be at least 20 characters.",
			optimizeTitle: "Optimize input",
			optimizeNoModel: "Current model unavailable — select a model first",
			archiveTrigger: "Archive",
			archiveTriggerAria: "View archived conversations",
			archivePanelTitle: "Archived conversations",
			archiveEmpty: "No archived conversations yet.",
			archiveSelectAll: "Select all",
			archiveDelete: "Delete",
			archiveDeleteConfirm: "Permanently delete the selected {n} archived conversations? This cannot be undone.",
			archiveDeleteOk: "Deleted {n} conversations",
			archiveDeleteSkipped: "Skipped {n} active/loaded sessions",
			archiveNoWorkspace: "(no workspace)",
			archiveLoading: "Loading…",
			rescueTitle: "Rescue Mode",
			rescueIntro: "DeepSeek Harness detected an abnormal startup and entered rescue mode: every third-party plugin except this one was disabled and the harness is running with the minimal configuration. Pick the plugins to re-enable.",
			rescueFailure: "Reason",
			rescueReasonCrash: "The previous boot did not complete (a plugin conflict or a failed third-party plugin is likely) — disabled automatically",
			rescueReasonLoadFailed: "Failed to load at startup (possibly not built, missing dependencies, or an init error)",
			rescueReasonDuplicateIds: "Duplicate loader entry ids (likely a plugin conflict)",
			rescueReasonManual: "Disabled when rescue mode was requested manually",
			rescueReasonBundle: "Third-party profile bundle (dsh.profile.bundles)",
			rescueRestoreAll: "Restore all",
			rescueKeepDisabled: "Keep disabled",
			rescueApplySelected: "Enable selected & reload",
			rescueApplying: "Applying and reloading…",
			rescueReloadPage: "Applied — the page will refresh automatically…",
			rescueReloadProcess: "Applied — the host process is restarting…",
			rescueEmpty: "No third-party plugins to restore.",
			rescueDismiss: "Later",
			rescueManualTrigger: "Enter rescue mode",
			rescueManualHint: "Disable every third-party plugin except this one and reload with the minimal configuration (manual recovery for startup failures)",
			rescueTriggerOk: "Rescue mode applied: {n} third-party plugin(s) disabled"
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
			if (!json.ok) {
				var failure = new Error(json.error && json.error.message ? json.error.message : "request failed");
				failure.code = json.error && json.error.code ? json.error.code : "bad-response";
				throw failure;
			}
			return json.value;
		}
		//#endregion
		//#region lib/types/client/limits.js
		/** UI fallbacks while /ext/api/state has not delivered the server limits yet. */
		var DEFAULT_LIMITS = {
			treeMaxEntries: 2000,
			terminalMaxSessions: 8,
			mcpMaxServers: 16,
			gitLogMax: 30,
			visionMaxImagesCap: 8,
			visionMaxTokens: 1024,
			terminalPollMs: 300,
			terminalListPollMs: 2000,
			gitPollMs: 5000,
			mcpPollMs: 3000
		};
		/** Pick the numeric limit fields from a state payload, falling back per key. */
		function pickLimits(value) {
			var out = {};
			for (var key in DEFAULT_LIMITS) {
				out[key] = value && typeof value[key] === "number" && value[key] > 0 ? value[key] : DEFAULT_LIMITS[key];
			}
			return out;
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
			}, props.children !== void 0 ? { children: props.busy ? "…" : props.children } : {}));
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
					setMessage(t("pluginInstallOk") + value.name + " (" + (value.version || "?") + ") — " + t("pluginInstallNote") + (value.builtFromSource ? t("pluginInstallBuilt") : ""));
					load();
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [mode, spec, url, folder, git, t, load]);
			var toggle = useCallback(function (pluginName, enabled) {
				setBusy(true);
				callApi("/ext/api/plugin/set-enabled", { name: pluginName, enabled: enabled }).then(function () {
					setMessage((enabled ? t("pluginEnabled") : t("pluginDisabled")) + ": " + pluginName);
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
			var triggerRescue = useCallback(function () {
				if (busy) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/rescue/trigger", {}).then(function (value) {
					setMessage(t("rescueTriggerOk").replace("{n}", String(value && typeof value.count === "number" ? value.count : 0)));
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
					jsxs("div", { className: "extc-card-title-row", children: [
						jsx("h3", { className: "extc-card-title", children: t("pluginListTitle") }),
						jsx(Button, { small: true, busy: busy, onClick: triggerRescue, title: t("rescueManualHint"), children: t("rescueManualTrigger") })
					] }),
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
		/** The Settings tab: ext-center settings through the plugin's own /ext/api endpoints. */
		function SettingsTab(props) {
			var t = props.t;
			var loadState = props.loadState;
			var _a = useState(null), state = _a[0], setState = _a[1];
			var _b = useState(null), draft = _b[0], setDraft = _b[1];
			var _c = useState(null), error = _c[0], setError = _c[1];
			var _d = useState(null), message = _d[0], setMessage = _d[1];
			var _e = useState(false), busy = _e[0], setBusy = _e[1];
			var _f = useState([]), providers = _f[0], setProviders = _f[1];
			var _g = useState(DEFAULT_LIMITS), limits = _g[0], setLimits = _g[1];
			var ready = state !== null && state.config !== void 0;
			var writable = !state || state.settingsWritable !== false;
			var load = useCallback(function () {
				if (typeof loadState !== "function") return;
				loadState().then(function (value) {
					setState(value);
					setProviders(Array.isArray(value.llmProviders) ? value.llmProviders : []);
					setLimits(pickLimits(value.limits));
				}, function () { /* non-fatal */ });
			}, [loadState]);
			useEffect(function () { load(); }, [load]);
			useEffect(function () {
				if (!ready || draft !== null) return;
				var value = state.config || {};
				var vision = value.vision && typeof value.vision === "object" ? value.vision : {};
				setDraft({
					allowLan: !!value.allowLan,
					skillRoot: typeof value.skillRoot === "string" ? value.skillRoot : "",
					treeRoot: typeof value.treeRoot === "string" ? value.treeRoot : "",
					customSkillDirs: Array.isArray(value.customSkillDirs) ? value.customSkillDirs.join("\n") : "",
					visionEnabled: vision.enabled === true,
					visionProvider: typeof vision.provider === "string" ? vision.provider : "",
					visionModel: typeof vision.model === "string" ? vision.model : "",
					visionPrompt: typeof vision.prompt === "string" ? vision.prompt : "",
					visionApiUrl: typeof vision.apiUrl === "string" ? vision.apiUrl : "",
					// The key is write-only: the draft always starts blank and
					// only a non-empty entry updates the stored key.
					visionApiKey: "",
					visionMaxImages: Number(vision.maxImages) > 0 ? String(Math.round(Number(vision.maxImages))) : "",
					visionMaxTokens: Number(vision.maxTokens) > 0 ? String(Math.round(Number(vision.maxTokens))) : ""
				});
			}, [ready, draft, state]);
			var save = useCallback(function () {
				if (!ready || draft === null) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				var value = state.config || {};
				var patch = {};
				var custom = draft.customSkillDirs.split("\n").map(function (line) { return line.trim(); }).filter(function (line) { return line.length > 0; });
				if (!!draft.allowLan !== !!value.allowLan) patch.allowLan = draft.allowLan;
				if (draft.skillRoot !== (value.skillRoot || "")) patch.skillRoot = draft.skillRoot.trim();
				if (draft.treeRoot !== (value.treeRoot || "")) patch.treeRoot = draft.treeRoot.trim();
				if (custom.join("\u0000") !== (Array.isArray(value.customSkillDirs) ? value.customSkillDirs.join("\u0000") : "")) patch.customSkillDirs = custom;
				var visionValue = value.vision && typeof value.vision === "object" ? value.vision : {};
				// Clearing maxImages resets it to the default; clearing
				// maxTokens resets it to the deployment default too. Both empty
				// fields therefore mean "use the default" — matching the hint.
				var visionDraft = {
					enabled: !!draft.visionEnabled,
					provider: draft.visionProvider.trim(),
					model: draft.visionModel.trim(),
					prompt: draft.visionPrompt.trim(),
					apiUrl: draft.visionApiUrl.trim(),
					maxImages: draft.visionMaxImages.trim() === "" ? Math.min(4, limits.visionMaxImagesCap) : Math.min(Math.max(parseInt(draft.visionMaxImages, 10) || 4, 1), limits.visionMaxImagesCap),
					maxTokens: draft.visionMaxTokens.trim() === "" ? limits.visionMaxTokens : Math.min(Math.max(parseInt(draft.visionMaxTokens, 10) || 0, 64), 8192)
				};
				// A non-empty key entry updates the stored key; an empty entry
				// (the usual state — the key never renders back) means "keep".
				if (draft.visionApiKey.trim() !== "") visionDraft.apiKey = draft.visionApiKey.trim();
				var visionChanged = visionDraft.enabled !== (visionValue.enabled === true) || visionDraft.provider !== (visionValue.provider || "") || visionDraft.model !== (visionValue.model || "") || visionDraft.prompt !== (visionValue.prompt || "") || visionDraft.apiUrl !== (visionValue.apiUrl || "") || visionDraft.maxImages !== (Number(visionValue.maxImages) || Math.min(4, limits.visionMaxImagesCap)) || ("apiKey" in visionDraft) || visionDraft.maxTokens !== (Number(visionValue.maxTokens) || limits.visionMaxTokens);
				if (visionChanged) patch.vision = visionDraft;
				if (Object.keys(patch).length === 0) {
					setMessage(t("noop"));
					setBusy(false);
					return;
				}
				callApi("/ext/api/config", patch).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, draft, state, limits.visionMaxImagesCap, limits.visionMaxTokens, t]);
			var reset = useCallback(function (field) {
				if (!ready) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/config", { reset: [field] }).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, t]);
			var visionOptions = providers.map(function (p) { return { value: p.id, label: (p.name && p.name !== p.id ? p.name + " · " : "") + p.id }; });
			visionOptions.unshift({ value: "", label: "—" });
			visionOptions.push({ value: "custom", label: t("visionProviderCustom") });
			if (draft !== null && draft.visionProvider !== "" && draft.visionProvider !== "custom" && !visionOptions.some(function (o) { return o.value === draft.visionProvider; })) {
				visionOptions.push({ value: draft.visionProvider, label: draft.visionProvider + " " + t("visionCustom") });
			}
			// The stored vision profile as reported by /ext/api/state (the key
			// itself is never echoed back — only its configured flag).
			var visionValue = state && state.config && state.config.vision && typeof state.config.vision === "object" ? state.config.vision : {};
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
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("customSkillDirs"); }, children: t("reset") + " · customSkillDirs" }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("vision"); }, children: t("reset") + " · vision" })
						] })
					] }),
					jsx(StatusLine, { error: error, message: message })
				] }),
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("visionTitle") }),
					jsx("p", { className: "extc-empty", children: t("visionIntro") }),
					!ready || draft === null ? null : jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("visionEnabled"), children: jsx("label", { className: "extc-check", children: [
							jsx("input", { type: "checkbox", checked: draft.visionEnabled, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { visionEnabled: event.target.checked })); } }),
							jsx("span", { children: draft.visionEnabled ? t("pluginEnabled") : t("pluginDisabled") })
						] }) }),
						jsx(Field, { label: t("visionProvider"), hint: t("visionProviderHint"), children: jsx(Select, { value: draft.visionProvider, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { visionProvider: value })); }, options: visionOptions }) }),
						draft.visionProvider === "custom" ? jsx(Field, { label: t("visionApiUrl"), hint: t("visionApiUrlHint"), children: jsx(TextInput, { value: draft.visionApiUrl, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { visionApiUrl: value })); } }) }) : null,
						draft.visionProvider === "custom" ? jsx(Field, { label: t("visionApiKey"), hint: t("visionApiKeyHint"), children: jsxs("div", { className: "extc-keyrow", children: [
							jsx("input", { type: "password", className: "extc-input", value: draft.visionApiKey, disabled: !writable || busy, placeholder: t("visionApiKeyPlaceholder"), autoComplete: "off", spellCheck: false, onChange: function (event) { setDraft(Object.assign({}, draft, { visionApiKey: event.target.value })); } }),
							jsx("span", { className: "extc-tag", children: visionValue.apiKeyConfigured === true ? t("visionApiKeySet") : t("visionApiKeyUnset") })
						] }) }) : null,
						jsx(Field, { label: t("visionModel"), hint: t("visionModelHint"), children: jsx(TextInput, { value: draft.visionModel, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { visionModel: value })); } }) }),
						jsx(Field, { label: t("visionPrompt"), hint: t("visionPromptHint"), children: jsx(TextArea, { value: draft.visionPrompt, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { visionPrompt: value })); }, rows: 3 }) }),
						jsx(Field, { label: t("visionMaxImages"), hint: t("visionMaxImagesHint").replace("{n}", String(limits.visionMaxImagesCap)), children: jsx(TextInput, { value: draft.visionMaxImages, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { visionMaxImages: value })); } }) }),
						jsx(Field, { label: t("visionMaxTokens"), hint: t("visionMaxTokensHint"), children: jsx("input", { type: "number", min: 64, max: 8192, step: 64, className: "extc-input", value: draft.visionMaxTokens, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { visionMaxTokens: event.target.value })); } }) }),
						jsx("p", { className: "extc-empty", children: t("visionNote") }),
						jsxs("div", { className: "extc-actions", children: [
							jsx(Button, { primary: true, busy: busy, disabled: !writable, onClick: save, children: t("save") }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { reset("vision"); }, children: t("reset") + " · vision" })
						] })
					] })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/TavilyTab.js
		/** The Tavily tab: search service configuration through /ext/api. */
		function TavilyTab(props) {
			var t = props.t;
			var loadState = props.loadState;
			var _a = useState(null), state = _a[0], setState = _a[1];
			var _b = useState(null), draft = _b[0], setDraft = _b[1];
			var _c = useState(null), error = _c[0], setError = _c[1];
			var _d = useState(null), message = _d[0], setMessage = _d[1];
			var _e = useState(false), busy = _e[0], setBusy = _e[1];
			var ready = state !== null && state.config !== void 0;
			var writable = !state || state.settingsWritable !== false;
			var load = useCallback(function () {
				if (typeof loadState !== "function") return;
				loadState().then(function (value) { setState(value); }, function () { /* non-fatal */ });
			}, [loadState]);
			useEffect(function () { load(); }, [load]);
			useEffect(function () {
				if (!ready || draft !== null) return;
				var value = state.config || {};
				var tavily = value.tavily && typeof value.tavily === "object" ? value.tavily : {};
				setDraft({
					enabled: tavily.enabled === true,
					// The key is write-only: the draft always starts blank and
					// only a non-empty entry updates the stored key.
					apiKey: "",
					searchDepth: tavily.searchDepth === "advanced" ? "advanced" : "basic",
					maxResults: Number(tavily.maxResults) >= 1 && Number(tavily.maxResults) <= 10 ? String(Math.round(Number(tavily.maxResults))) : "5",
					includeRaw: tavily.includeRaw === true,
					showKey: false
				});
			}, [ready, draft, state]);
			// The stored Tavily profile as reported by /ext/api/state (the key
			// itself is never echoed back — only its configured flag).
			var tavilyValue = state && state.config && state.config.tavily && typeof state.config.tavily === "object" ? state.config.tavily : {};
			var save = useCallback(function () {
				if (!ready || draft === null) return;
				var apiKey = draft.apiKey.trim();
				if (apiKey !== "" && (!/^tvly-[A-Za-z0-9_-]+$/.test(apiKey) || apiKey.length < 20)) {
					setError(t("tavilyKeyInvalid"));
					return;
				}
				var maxResults = parseInt(draft.maxResults, 10);
				if (!Number.isFinite(maxResults) || maxResults < 1 || maxResults > 10) {
					setError(t("tavilyMaxResultsInvalid"));
					return;
				}
				if (draft.enabled && apiKey === "" && tavilyValue.apiKeyConfigured !== true) {
					setError(t("tavilyKeyRequired"));
					return;
				}
				setBusy(true);
				setError(null);
				setMessage(null);
				var patch = {
					tavily: {
						enabled: !!draft.enabled,
						searchDepth: draft.searchDepth === "advanced" ? "advanced" : "basic",
						maxResults: maxResults,
						includeRaw: !!draft.includeRaw
					}
				};
				// A non-empty key entry updates the stored key; an empty entry
				// (the usual state — the key never renders back) means "keep".
				if (apiKey !== "") patch.tavily.apiKey = apiKey;
				callApi("/ext/api/config", patch).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, draft, state, t]);
			var reset = useCallback(function () {
				if (!ready) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/config", { reset: ["tavily"] }).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, t]);
			return jsxs("div", { className: "extc-panel", children: [
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("tavilyTitle") }),
					jsx("p", { className: "extc-empty", children: t("tavilyIntro") }),
					!writable ? jsx("p", { className: "extc-error", children: t("readOnly") }) : null,
					!ready ? jsx("p", { className: "extc-empty", children: t("loading") }) : draft === null ? jsx("p", { className: "extc-empty", children: t("loading") }) : jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("tavilyEnabled"), children: jsx("label", { className: "extc-check", children: [
							jsx("input", { type: "checkbox", checked: draft.enabled, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { enabled: event.target.checked })); } }),
							jsx("span", { children: draft.enabled ? t("pluginEnabled") : t("pluginDisabled") })
						] }) }),
						jsx(Field, { label: t("tavilyApiKey"), hint: t("tavilyApiKeyHint"), children: jsxs("div", { className: "extc-keyrow", children: [
							jsx("input", { type: draft.showKey ? "text" : "password", className: "extc-input", value: draft.apiKey, disabled: !writable || busy, placeholder: t("tavilyApiKeyPlaceholder"), autoComplete: "off", spellCheck: false, onChange: function (event) { setDraft(Object.assign({}, draft, { apiKey: event.target.value })); } }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { setDraft(Object.assign({}, draft, { showKey: !draft.showKey })); }, children: draft.showKey ? t("tavilyHideKey") : t("tavilyShowKey") }),
							jsx("span", { className: "extc-tag", children: tavilyValue.apiKeyConfigured === true ? t("tavilyApiKeySet") : t("tavilyApiKeyUnset") })
						] }) }),
						jsx(Field, { label: t("tavilySearchDepth"), hint: t("tavilySearchDepthHint"), children: jsx(Select, { value: draft.searchDepth, disabled: !writable || busy, onChange: function (value) { setDraft(Object.assign({}, draft, { searchDepth: value })); }, options: [
							{ value: "basic", label: t("tavilyDepthBasic") },
							{ value: "advanced", label: t("tavilyDepthAdvanced") }
						] }) }),
						jsx(Field, { label: t("tavilyMaxResults"), hint: t("tavilyMaxResultsHint"), children: jsx("input", { type: "number", min: 1, max: 10, step: 1, className: "extc-input", value: draft.maxResults, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { maxResults: event.target.value })); } }) }),
						jsx(Field, { label: t("tavilyIncludeRaw"), hint: t("tavilyIncludeRawHint"), children: jsx("label", { className: "extc-check", children: [
							jsx("input", { type: "checkbox", checked: draft.includeRaw, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { includeRaw: event.target.checked })); } }),
							jsx("span", { children: draft.includeRaw ? t("pluginEnabled") : t("pluginDisabled") })
						] }) }),
						jsx("p", { className: "extc-empty", children: t("tavilyNote") }),
						jsxs("div", { className: "extc-actions", children: [
							jsx(Button, { primary: true, busy: busy, disabled: !writable, onClick: save, children: t("save") }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: reset, children: t("reset") + " · " + t("tabTavily") })
						] })
					] }),
					jsx(StatusLine, { error: error, message: message })
				] })
			] });
		}
		//#endregion
		//#region lib/types/client/GitHubTab.js
		/** The GitHub tab: GitHub REST API access configuration through /ext/api. */
		function GitHubTab(props) {
			var t = props.t;
			var loadState = props.loadState;
			var _a = useState(null), state = _a[0], setState = _a[1];
			var _b = useState(null), draft = _b[0], setDraft = _b[1];
			var _c = useState(null), error = _c[0], setError = _c[1];
			var _d = useState(null), message = _d[0], setMessage = _d[1];
			var _e = useState(false), busy = _e[0], setBusy = _e[1];
			var ready = state !== null && state.config !== void 0;
			var writable = !state || state.settingsWritable !== false;
			var load = useCallback(function () {
				if (typeof loadState !== "function") return;
				loadState().then(function (value) { setState(value); }, function () { /* non-fatal */ });
			}, [loadState]);
			useEffect(function () { load(); }, [load]);
			useEffect(function () {
				if (!ready || draft !== null) return;
				var value = state.config || {};
				var github = value.github && typeof value.github === "object" ? value.github : {};
				setDraft({
					enabled: github.enabled === true,
					// The token is write-only: the draft always starts blank and
					// only a non-empty entry updates the stored token.
					token: "",
					showKey: false
				});
			}, [ready, draft, state]);
			// The stored GitHub profile as reported by /ext/api/state (the token
			// itself is never echoed back — only its configured flag).
			var githubValue = state && state.config && state.config.github && typeof state.config.github === "object" ? state.config.github : {};
			var save = useCallback(function () {
				if (!ready || draft === null) return;
				var token = draft.token.trim();
				if (token !== "" && (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_-]+$/.test(token) || token.length < 20)) {
					setError(t("githubKeyInvalid"));
					return;
				}
				setBusy(true);
				setError(null);
				setMessage(null);
				var patch = {
					github: {
						enabled: !!draft.enabled
					}
				};
				// A non-empty token entry updates the stored token; an empty entry
				// (the usual state — the token never renders back) means "keep".
				if (token !== "") patch.github.token = token;
				callApi("/ext/api/config", patch).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, draft, state, t]);
			var reset = useCallback(function () {
				if (!ready) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/config", { reset: ["github"] }).then(function (next) {
					setState(next);
					setDraft(null);
					setMessage(t("saved"));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [ready, t]);
			return jsxs("div", { className: "extc-panel", children: [
				jsxs("div", { className: "extc-card", children: [
					jsx("h3", { className: "extc-card-title", children: t("githubTitle") }),
					jsx("p", { className: "extc-empty", children: t("githubIntro") }),
					!writable ? jsx("p", { className: "extc-error", children: t("readOnly") }) : null,
					!ready ? jsx("p", { className: "extc-empty", children: t("loading") }) : draft === null ? jsx("p", { className: "extc-empty", children: t("loading") }) : jsxs("div", { className: "extc-form", children: [
						jsx(Field, { label: t("githubEnabled"), children: jsx("label", { className: "extc-check", children: [
							jsx("input", { type: "checkbox", checked: draft.enabled, disabled: !writable || busy, onChange: function (event) { setDraft(Object.assign({}, draft, { enabled: event.target.checked })); } }),
							jsx("span", { children: draft.enabled ? t("pluginEnabled") : t("pluginDisabled") })
						] }) }),
						jsx(Field, { label: t("githubToken"), hint: t("githubTokenHint"), children: jsxs("div", { className: "extc-keyrow", children: [
							jsx("input", { type: draft.showKey ? "text" : "password", className: "extc-input", value: draft.token, disabled: !writable || busy, placeholder: t("githubTokenPlaceholder"), autoComplete: "off", spellCheck: false, onChange: function (event) { setDraft(Object.assign({}, draft, { token: event.target.value })); } }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: function () { setDraft(Object.assign({}, draft, { showKey: !draft.showKey })); }, children: draft.showKey ? t("githubHideKey") : t("githubShowKey") }),
							jsx("span", { className: "extc-tag", children: githubValue.tokenConfigured === true ? t("githubTokenSet") : t("githubTokenUnset") })
						] }) }),
						jsx("p", { className: "extc-empty", children: t("githubNote") }),
						jsxs("div", { className: "extc-actions", children: [
							jsx(Button, { primary: true, busy: busy, disabled: !writable, onClick: save, children: t("save") }),
							jsx(Button, { small: true, disabled: !writable || busy, onClick: reset, children: t("reset") + " · " + t("tabGithub") })
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
			var fileRequest = useRef(0);
			var dirLoading = useRef(new Set());
			var refresh = useCallback(function () {
				setError(null);
				treeEntries("").then(function (value) {
					setRoot(value);
					setChildren({});
					setExpanded(new Set());
					setFailures({});
					dirLoading.current.clear();
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
				var requestId = ++fileRequest.current;
				setEditorError(null);
				setEditorMessage(null);
				setEditorText("");
				setEditorBusy(true);
				setEditing({ path: filePath, name: name });
				treeFileRead(filePath).then(function (value) {
					// A slower earlier read must never overwrite a newer file.
					if (requestId !== fileRequest.current) return;
					setEditorText(value.content);
					setEditorBusy(false);
				}, function (reason) {
					if (requestId !== fileRequest.current) return;
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
				if (dirLoading.current.has(dirPath)) return;
				dirLoading.current.add(dirPath);
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
					dirLoading.current.delete(dirPath);
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
							kids.truncated ? jsx("div", { className: "extc-tnote", children: t("treeTruncated").replace("{n}", String(kids.maxEntries || DEFAULT_LIMITS.treeMaxEntries)) }) : null
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
						root.truncated ? jsx("div", { className: "extc-tnote", children: t("treeTruncated").replace("{n}", String(root.maxEntries || DEFAULT_LIMITS.treeMaxEntries)) }) : null
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
		/** Client-side DOM safety invariant: output kept in the pane is capped. */
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
			var _g = useState(DEFAULT_LIMITS), limits = _g[0], setLimits = _g[1];
			var cursor = useRef(0);
			var outputRef = useRef(null);
			var activeKeyRef = useRef(null);
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
				callApi("/ext/api/state").then(function (value) { setLimits(pickLimits(value.limits)); }, function () { /* keep the display defaults */ });
			}, []);
			useEffect(function () {
				var timer = window.setInterval(loadList, limits.terminalListPollMs);
				return function () { window.clearInterval(timer); };
			}, [loadList, limits]);
			useEffect(function () {
				cursor.current = 0;
				setOutput("");
			}, [activeKey]);
			useEffect(function () {
				activeKeyRef.current = activeKey;
				if (!activeKey) return;
				var timer = window.setInterval(function () {
					callApi("/ext/api/terminal/output?id=" + encodeURIComponent(activeKey) + "&after=" + cursor.current).then(function (value) {
						// Ignore responses that raced a terminal switch: appending
						// them would mix the previous terminal's output into the
						// newly active pane and corrupt the shared cursor.
						if (activeKeyRef.current !== activeKey) return;
						if (value.text) {
							setOutput(function (prev) {
								var next = prev + value.text;
								return next.length > TERMINAL_DISPLAY_LIMIT ? next.slice(next.length - TERMINAL_DISPLAY_LIMIT) : next;
							});
						}
						if (Number.isFinite(value.cursor)) cursor.current = value.cursor;
						else if (value.text) cursor.current += value.text.length;
						if (!value.alive) {
							setTerminals(function (prev) {
								return prev.map(function (x) {
									if (x.id !== activeKey || x.alive === false) return x;
									return Object.assign({}, x, { alive: false, exitCode: value.exitCode });
								});
							});
						}
					}, function () { /* transient poll failures are ignored */ });
				}, limits.terminalPollMs);
				return function () { window.clearInterval(timer); };
			}, [activeKey, limits]);
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
			var termMax = limits.terminalMaxSessions;
			var atCap = terminals.length >= termMax;
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
						jsx("span", { className: "extc-term-count", children: atCap ? t("termCap").replace("{n}", String(termMax)) : (terminals.length + " / " + termMax) })
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
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			// The callbacks below are memoized, so gitCall reads the session
			// through a ref: a session switch must not leave them targeting
			// the previously mounted conversation.
			var sessionIdRef = useRef(sessionId);
			sessionIdRef.current = sessionId;
			var gitCall = function (path, body) {
				var currentSession = sessionIdRef.current || "";
				var sep = path.indexOf("?") === -1 ? "?" : "&";
				if (currentSession) path = path + sep + "sessionId=" + encodeURIComponent(currentSession);
				if (body === void 0) return callApi(path);
				var payload = Object.assign({}, body || {});
				if (currentSession) payload.sessionId = currentSession;
				return callApi(path, payload);
			};
			var _a = useState(null), repo = _a[0], setRepo = _a[1];
			var _b = useState([]), branches = _b[0], setBranches = _b[1];
			var _c = useState([]), commits = _c[0], setCommits = _c[1];
			var _d = useState(""), message = _d[0], setMessage = _d[1];
			var _e = useState(null), sel = _e[0], setSel = _e[1];
			var _f = useState(null), diff = _f[0], setDiff = _f[1];
			var _g = useState(null), error = _g[0], setError = _g[1];
			var _h = useState(null), ok = _h[0], setOk = _h[1];
			var _i = useState(null), busy = _i[0], setBusy = _i[1];
			var _j = useState(DEFAULT_LIMITS), limits = _j[0], setLimits = _j[1];
			var diffRequest = useRef(0);
			var changes = repo ? repo.changes || [] : [];
			var staged = changes.filter(function (c) { return c.staged === true; });
			var unstaged = changes.filter(function (c) { return c.unstaged === true && c.untracked !== true; });
			var untracked = changes.filter(function (c) { return c.untracked === true; });
			var hasConflicts = changes.some(function (c) { return c.unmerged === true; });
			var refresh = useCallback(function () {
				gitCall("/ext/api/git/status").then(function (value) {
					setRepo(value);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
				gitCall("/ext/api/git/log?n=" + limits.gitLogMax).then(function (value) {
					setCommits(value.commits || []);
				}, function () { /* log failures are non-fatal */ });
			}, [limits.gitLogMax]);
			var loadBranches = useCallback(function () {
				gitCall("/ext/api/git/branches").then(function (value) {
					setBranches(value.branches || []);
				}, function () { /* non-fatal */ });
			}, []);
			useEffect(function () {
				callApi("/ext/api/state").then(function (value) { setLimits(pickLimits(value.limits)); }, function () { /* keep the display defaults */ });
			}, []);
			useEffect(function () {
				refresh();
				loadBranches();
				var timer = window.setInterval(refresh, limits.gitPollMs);
				return function () { window.clearInterval(timer); };
			}, [refresh, loadBranches, limits.gitPollMs]);
			var loadDiff = useCallback(function (path, stagedFlag) {
				var requestId = ++diffRequest.current;
				setSel({ path: path, staged: stagedFlag });
				setDiff({ loading: true, path: path, staged: stagedFlag });
				gitCall("/ext/api/git/diff?path=" + encodeURIComponent(path) + "&staged=" + (stagedFlag ? "1" : "0")).then(function (value) {
					// A slower earlier response must never overwrite a newer diff.
					if (requestId !== diffRequest.current) return;
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
					if (requestId !== diffRequest.current) return;
					setDiff({ loading: false, path: path, staged: stagedFlag, failed: String(reason && reason.message ? reason.message : reason) });
				});
			}, []);
			var closeDiff = useCallback(function () {
				setSel(null);
				setDiff(null);
			}, []);
			// After a status refresh the selected file may be gone or have
			// moved groups; drop a stale diff instead of showing a view that
			// no longer matches any highlighted row.
			useEffect(function () {
				if (!repo || !sel) return;
				var stillListed = changes.some(function (change) {
					return change.path === sel.path && change.staged === sel.staged;
				});
				if (!stillListed) {
					setSel(null);
					setDiff(null);
				}
			}, [repo, sel]);
			var toggleStage = useCallback(function (change, group) {
				if (busy !== null) return;
				var unstage = group === "staged";
				setBusy("toggle");
				setError(null);
				setOk(null);
				gitCall(unstage ? "/ext/api/git/unstage" : "/ext/api/git/stage", { paths: [change.path] }).then(function () {
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
				gitCall("/ext/api/git/stage-all", {}).then(function () {
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
				gitCall("/ext/api/git/unstage-all", {}).then(function () {
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
				gitCall("/ext/api/git/commit", { message: message.trim() }).then(function () {
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
				gitCall("/ext/api/git/discard", { paths: [change.path] }).then(function () {
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
				gitCall("/ext/api/git/" + op, {}).then(function (value) {
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
				gitCall("/ext/api/git/checkout", { branch: branch }).then(function () {
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
					jsx(Select, {
						value: repo ? (repo.branch || (repo.detached ? "" : "")) : "",
						disabled: busy !== null || branches.length === 0,
						onChange: function (name) { if (name && name !== (repo ? repo.branch : "")) checkout(name); },
						options: (repo && repo.detached ? [{ value: "", label: t("gitDetached") }] : []).concat(branches.map(function (b) { return { value: b.name, label: (b.current ? "✓ " : "") + b.name }; }))
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
			var _n = useState(DEFAULT_LIMITS), limits = _n[0], setLimits = _n[1];
			var load = useCallback(function () {
				callApi("/ext/api/mcp/list").then(function (value) {
					setServers(value.servers || []);
					setError(null);
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				});
			}, []);
			useEffect(function () {
				callApi("/ext/api/state").then(function (value) { setLimits(pickLimits(value.limits)); }, function () { /* keep the display defaults */ });
			}, []);
			useEffect(function () {
				load();
				var timer = window.setInterval(load, limits.mcpPollMs);
				return function () { window.clearInterval(timer); };
			}, [load, limits.mcpPollMs]);
			var add = useCallback(function () {
				if (busy || !name.trim()) return;
				setError(null);
				setMessage(null);
				var payload = { name: name.trim(), transport: transport };
				if (timeoutText.trim() !== "") {
					var timeoutMs = Number(timeoutText.trim());
					if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) {
						setError(t("mcpTimeoutInvalid"));
						return;
					}
					payload.toolCallTimeoutMs = timeoutMs;
				}
				if (transport === "stdio") {
					payload.command = command.trim();
					var args = mcpLines(argsText);
					if (args.length > 0) payload.args = args;
					var envLines = mcpLines(envText);
					if (envLines.some(function (line) { return line.indexOf("=") <= 0; })) {
						setError(t("mcpEnvInvalid"));
						return;
					}
					var env = mcpKeyValues(envText, "=");
					if (Object.keys(env).length > 0) payload.env = env;
					payload.cwd = cwd.trim();
				} else {
					payload.url = url.trim();
					var headerLines = mcpLines(headersText);
					if (headerLines.some(function (line) { return line.indexOf(":") <= 0; })) {
						setError(t("mcpHeadersInvalid"));
						return;
					}
					var headers = mcpKeyValues(headersText, ":");
					if (Object.keys(headers).length > 0) payload.headers = headers;
				}
				// Validation above may fail before the request starts; flip busy
				// only once the payload is known to be well-formed so a rejected
				// form does not leave every control disabled.
				setBusy(true);
				callApi("/ext/api/mcp/add", payload).then(function (value) {
					setBusy(false);
					setMessage(t("mcpAdded") + value.name);
					setName("");
					setCommand("");
					setArgsText("");
					setEnvText("");
					setCwd("");
					setUrl("");
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
			var atCap = managedCount >= limits.mcpMaxServers;
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
							atCap ? jsx("span", { className: "extc-empty", children: t("mcpCap").replace("{n}", String(limits.mcpMaxServers)) }) : null
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
		//#region lib/types/client/OptimizeInputAction.js
		/** Resolve the last assistant request model from the conversation snapshot. */
		function lastModelFromSession(session) {
			if (!session || !Array.isArray(session.nodes)) return null;
			for (var index = session.nodes.length - 1; index >= 0; index--) {
				var node = session.nodes[index];
				if (!node || node.kind !== "assistant") continue;
				var config = node.requestConfig;
				if (config && config.provider && config.model) return { provider: config.provider, model: config.model };
				var provenance = node.provenance;
				if (provenance && provenance.provider && provenance.model) return { provider: provenance.provider, model: provenance.model };
			}
			return null;
		}
		/** Star icon markup for the vanilla DOM button. */
		function optimizeStarSvg() {
			return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.2l-3.8 2.1.7-4.3-3.1-3 4.3-.6L8 1.5z" fill="currentColor"></path></svg>';
		}
		/**
		 * The "optimize input" action. The React side renders only an invisible
		 * anchor in `conversation.input.right`; the real button is created as a
		 * plain DOM node and inserted immediately before the primary send button
		 * (between the context meter and send), because that exact seat has no
		 * dedicated slot. Keeping it outside the React tree also avoids React
		 * moving it back when the trailing row re-renders.
		 */
		function OptimizeInputAction(props) {
			var t = props.t;
			var input = props.input;
			var session = props.session;
			var inputActions = props.inputActions;
			var getCurrentModel = props.getCurrentModel;
			var _a = useState(false), busy = _a[0], setBusy = _a[1];
			var _b = useState(null), error = _b[0], setError = _b[1];
			var anchorRef = useRef(null);
			var buttonRef = useRef(null);
			var errorRef = useRef(null);
			var optimizeRef = useRef(null);
			var draft = input && typeof input.draft === "string" ? input.draft : "";
			var locked = !!input && (input.phase === "submitting" || input.phase === "adjudicating");
			var optimize = useCallback(function () {
				var text = draft.trim();
				if (!text || busy || locked) return;
				setBusy(true);
				setError(null);
				var resolveModel = typeof getCurrentModel === "function" ? getCurrentModel() : Promise.resolve(null);
				Promise.resolve(resolveModel).then(function (selection) {
					if (selection && selection.provider && selection.model) return selection;
					var fallback = lastModelFromSession(session);
					if (fallback) return fallback;
					throw new Error(t("optimizeNoModel"));
				}).then(function (selection) {
					return callApi("/ext/api/input/optimize", {
						text: text,
						sessionId: props.sessionId || (session && session.sessionId),
						provider: selection.provider,
						model: selection.model,
						reasoningEffort: selection.reasoningEffort
					});
				}).then(function (value) {
					if (value && typeof value.text === "string" && inputActions && typeof inputActions.setDraft === "function") {
						inputActions.setDraft(value.text);
					}
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			}, [draft, busy, locked, t, getCurrentModel, inputActions, session, props.sessionId]);
			// Keep the latest optimize closure available to the DOM button's click handler.
			useLayoutEffect(function () {
				optimizeRef.current = optimize;
			}, [optimize]);
			// Create the real button once and place it before the primary send
			// button. The composer card's last child is the tool row, whose last
			// child is the trailing group; its last child is the send control.
			useLayoutEffect(function () {
				var anchor = anchorRef.current;
				if (!anchor || typeof document === "undefined") return;
				var card = anchor.closest("[data-composer-card]");
				if (!card) return;
				var row = card.lastElementChild;
				if (!row) return;
				var trailing = row.lastElementChild;
				if (!trailing) return;
				var button = document.createElement("button");
				button.type = "button";
				button.className = "extc-optimize-btn";
				button.innerHTML = optimizeStarSvg();
				button.addEventListener("mousedown", function (event) { event.preventDefault(); });
				button.addEventListener("click", function () {
					if (typeof optimizeRef.current === "function") optimizeRef.current();
				});
				var errorNode = document.createElement("span");
				errorNode.className = "extc-optimize-error";
				errorNode.hidden = true;
				var sendSlot = trailing.lastElementChild;
				trailing.insertBefore(errorNode, sendSlot);
				trailing.insertBefore(button, sendSlot);
				buttonRef.current = button;
				errorRef.current = errorNode;
				return function () {
					button.remove();
					errorNode.remove();
					buttonRef.current = null;
					errorRef.current = null;
				};
			}, []);
			// Mirror React state into the plain DOM button.
			useLayoutEffect(function () {
				var button = buttonRef.current;
				if (!button) return;
				button.title = error || t("optimizeTitle");
				button.setAttribute("aria-label", error || t("optimizeTitle"));
				button.disabled = busy || locked || !draft.trim();
				button.classList.toggle("extc-optimize-btn-busy", busy);
				button.innerHTML = busy ? '<span class="extc-optimize-spinner">…</span>' : optimizeStarSvg();
				var errorNode = errorRef.current;
				if (errorNode) {
					errorNode.textContent = error || "";
					errorNode.hidden = !error;
				}
			}, [draft, busy, locked, error, t]);
			return jsx("span", { ref: anchorRef, className: "extc-optimize-anchor", "aria-hidden": true });
		}
		//#endregion
		//#region lib/types/client/ArchivedAction.js
		/** Archive-box glyph (self-contained SVG, no dependency on a specific icon export). */
		function ArchiveGlyph(props) {
			var size = props.size || 16;
			return jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 20 20",
				fill: "none",
				"aria-hidden": true,
				focusable: "false",
				xmlns: "http://www.w3.org/2000/svg",
				children: [
					jsx("path", { fill: "currentColor", d: "M15.8659 2.05975C17.2603 2.05995 18.3913 3.19096 18.3914 4.58527V5.4874C18.3914 6.02747 18.2192 6.52672 17.9303 6.93735C17.9336 6.96524 17.9388 6.99318 17.9388 7.02195V12.8884C17.9388 13.6345 17.9395 14.2379 17.8996 14.7254C17.8642 15.1593 17.7936 15.5499 17.6373 15.9141L17.5654 16.0685C17.278 16.6328 16.8405 17.1046 16.3038 17.434L16.0679 17.5661C15.66 17.7739 15.2196 17.8598 14.7237 17.9003C14.2362 17.9401 13.6327 17.9405 12.8867 17.9405H7.11122C6.36511 17.9405 5.76171 17.9401 5.27418 17.9003C4.84051 17.8649 4.44949 17.7952 4.08545 17.6391L3.93104 17.5661C3.36673 17.2785 2.89392 16.8414 2.56465 16.3044L2.43245 16.0685C2.22473 15.6608 2.13878 15.2211 2.09825 14.7254C2.05841 14.2379 2.05912 13.6345 2.05912 12.8884V7.02195C2.05912 6.99284 2.06422 6.96449 2.06758 6.93629C1.77931 6.52592 1.60858 6.02687 1.60858 5.4874V4.58527C1.60876 3.19084 2.73962 2.05975 4.1341 2.05975H15.8659ZM16.4984 7.92936C16.296 7.98169 16.0847 8.01288 15.8659 8.01291H4.1341C3.91478 8.01291 3.70246 7.98194 3.49955 7.92936V12.8884C3.49955 13.6582 3.50053 14.1927 3.53445 14.608C3.56769 15.0146 3.62923 15.244 3.71635 15.415L3.7925 15.5514C3.98339 15.8627 4.25749 16.1165 4.58464 16.2833L4.72529 16.3435C4.88095 16.3993 5.08638 16.4402 5.39158 16.4651C5.80685 16.4991 6.34138 16.5001 7.11122 16.5001H12.8867C13.6564 16.5001 14.1911 16.499 14.6063 16.4651C15.0128 16.432 15.2423 16.3703 15.4133 16.2833L15.5508 16.2061C15.8618 16.0152 16.116 15.7419 16.2827 15.415L16.3429 15.2732C16.3985 15.1177 16.4396 14.9128 16.4645 14.608C16.4985 14.1927 16.4984 13.6583 16.4984 12.8884V7.92936ZM4.1341 3.50019C3.53511 3.50019 3.0492 3.98631 3.04902 4.58527V5.4874C3.04902 6.08649 3.535 6.57248 4.1341 6.57248H15.8659C16.4648 6.57228 16.951 6.08638 16.951 5.4874V4.58527C16.9509 3.98644 16.4647 3.50038 15.8659 3.50019H4.1341Z" }),
					jsx("path", { fill: "currentColor", d: "M12.7962 12.5661V11.0832H7.20548V12.5661L12.7962 12.5661Z" })
				]
			});
		}
		/** Format an epoch-millis timestamp for the archive list. */
		function formatArchiveTime(ts) {
			if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
			var date = new Date(ts);
			var pad = function (n) { return n < 10 ? "0" + n : String(n); };
			return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
		}
		/** The sidebar archived-conversations action: list archived sessions and batch delete them. */
		function ArchivedAction(props) {
			var wide = props.wide;
			var t = props.t;
			var useSessions = typeof props.useSessions === "function" ? props.useSessions : function () { return null; };
			var useWorkspaces = typeof props.useWorkspaces === "function" ? props.useWorkspaces : function () { return null; };
			var _a = useState(false), open = _a[0], setOpen = _a[1];
			var _b = useState({}), selected = _b[0], setSelected = _b[1];
			var _c = useState(null), error = _c[0], setError = _c[1];
			var _d = useState(null), message = _d[0], setMessage = _d[1];
			var _e = useState(false), busy = _e[0], setBusy = _e[1];
			var _f = useState(function () { return new Set(); }), hidden = _f[0], setHidden = _f[1];
			var triggerRef = useRef(null);
			var panelRef = useRef(null);
			var sessions = useSessions(function (snapshot) { return snapshot; });
			var workspaces = useWorkspaces(function (snapshot) { return snapshot; });
			var ready = !!(workspaces && workspaces.baselinesReady === true && sessions && sessions.phase === "ready");
			var archivedIds = workspaces && Array.isArray(workspaces.archivedSessionIds) ? workspaces.archivedSessionIds : [];
			var sessionsById = sessions && sessions.byId ? sessions.byId : {};
			var archived = archivedIds
				.filter(function (id) { return !hidden.has(id); })
				.map(function (id) { return sessionsById[id]; })
				.filter(function (summary) { return summary !== undefined; })
				.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
			var selectedCount = Object.keys(selected).filter(function (id) { return selected[id] === true; }).length;
			var allSelected = archived.length > 0 && archived.every(function (summary) { return selected[summary.id] === true; });
			var toggleAll = function () {
				var next = {};
				if (!allSelected) {
					for (var i = 0; i < archived.length; i++) next[archived[i].id] = true;
				}
				setSelected(next);
			};
			var toggleOne = function (id) {
				setSelected(function (prev) {
					var next = Object.assign({}, prev);
					if (next[id] === true) delete next[id];
					else next[id] = true;
					return next;
				});
			};
			var removeSelected = function () {
				var ids = Object.keys(selected).filter(function (id) { return selected[id] === true; });
				if (ids.length === 0 || busy) return;
				if (!window.confirm(t("archiveDeleteConfirm").replace("{n}", String(ids.length)))) return;
				setBusy(true);
				setError(null);
				setMessage(null);
				callApi("/ext/api/archive/delete", { ids: ids }).then(function (value) {
					var deleted = value && Array.isArray(value.deleted) ? value.deleted : [];
					var skipped = value && Array.isArray(value.skipped) ? value.skipped : [];
					setSelected({});
					setHidden(function (prev) {
						var next = new Set(prev);
						for (var i = 0; i < deleted.length; i++) next.add(deleted[i]);
						return next;
					});
					if (deleted.length > 0) setMessage(t("archiveDeleteOk").replace("{n}", String(deleted.length)));
					if (skipped.length > 0) setError(t("archiveDeleteSkipped").replace("{n}", String(skipped.length)));
				}, function (reason) {
					setError(String(reason && reason.message ? reason.message : reason));
				}).then(function () { setBusy(false); });
			};
			useEffect(function () {
				if (!open) return;
				var onPointerDown = function (event) {
					var target = event.target;
					if (panelRef.current && panelRef.current.contains(target)) return;
					if (triggerRef.current && triggerRef.current.contains(target)) return;
					setOpen(false);
				};
				var onKeyDown = function (event) { if (event.key === "Escape") setOpen(false); };
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return function () {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			return jsxs("div", { className: "extc-alayer", children: [
				open ? jsxs("section", { className: "extc-apanel", ref: panelRef, "aria-label": t("archivePanelTitle"), children: [
					jsxs("header", { className: "extc-aheader", children: [
						jsx("span", { className: "extc-atitle", children: t("archivePanelTitle") }),
						jsx("span", { className: "extc-acount", children: archived.length })
					] }),
					error ? jsx("div", { className: "extc-error", children: error }) : null,
					message ? jsx("div", { className: "extc-ok", children: message }) : null,
					archived.length === 0 ? jsx("p", { className: "extc-empty", children: ready ? t("archiveEmpty") : t("archiveLoading") }) : jsxs("div", { className: "extc-abody", children: [
						jsxs("div", { className: "extc-atoolbar", children: [
							jsx("label", { className: "extc-check", children: [
								jsx("input", { type: "checkbox", checked: allSelected, disabled: busy, onChange: toggleAll }),
								jsx("span", { children: t("archiveSelectAll") })
							] }),
							jsx(Button, { small: true, danger: true, busy: busy, disabled: selectedCount === 0 || busy, onClick: removeSelected, children: t("archiveDelete") + (selectedCount > 0 ? " (" + selectedCount + ")" : "") })
						] }),
						jsx("ul", { className: "extc-alist", children: archived.map(function (summary) {
							var id = summary.id;
							var checked = selected[id] === true;
							return jsxs("li", { className: "extc-arow" + (checked ? " extc-arow-checked" : ""), children: [
								jsx("label", { className: "extc-check", children: jsx("input", { type: "checkbox", checked: checked, disabled: busy, onChange: function () { toggleOne(id); } }) }),
								jsxs("div", { className: "extc-row-main", children: [
									jsx("span", { className: "extc-row-title", children: summary.displayTitle || id }),
									jsx("span", { className: "extc-row-sub", children: [
										summary.cwd || t("archiveNoWorkspace"),
										summary.updatedAt ? " · " + formatArchiveTime(summary.updatedAt) : ""
									] })
								] })
							] }, id);
						}) })
					] })
				] }) : null,
				jsx(_primitives.Tooltip, { label: t("archiveTrigger"), delayMs: 400, disabled: wide, children: jsx("button", {
					type: "button",
					ref: triggerRef,
					className: "extc-trigger" + (wide ? "" : " extc-trigger-rail") + (open ? " extc-trigger-open" : ""),
					"aria-label": t("archiveTriggerAria"),
					"aria-expanded": open ? "true" : "false",
					onClick: function () { setOpen(function (value) { return !value; }); },
					children: [
						jsx(ArchiveGlyph, { size: wide ? 14 : 18 }),
						wide ? jsx("span", { className: "extc-trigger-label", children: t("archiveTrigger") }) : null
					]
				}) })
			] });
		}
		//#endregion
		//#region lib/types/client/RescueDialog.js
		/** Localized reason text for one disabled plugin (code + optional detail). */
		function rescueReasonLabel(t, reason) {
			if (!reason || typeof reason !== "object") return "";
			var code = reason.code || "crash";
			var key = "rescueReason" + code.charAt(0).toUpperCase() + code.slice(1);
			var base = typeof t(key) === "string" ? t(key) : t("rescueReasonCrash");
			return typeof reason.detail === "string" && reason.detail !== "" ? base + ": " + reason.detail : base;
		}
		/**
		 * The rescue-mode dialog: when the host reports an applied rescue, list
		 * every disabled third-party plugin (name + reason) with a checkbox and
		 * let the user restore all, keep everything disabled, or re-enable a
		 * selection. The decision goes back to /ext/api/rescue/apply, which
		 * hot-applies the patch and reloads (page refresh in the desktop host,
		 * process respawn in a bare dsh web host).
		 */
		function RescueDialog(props) {
			var t = props.t;
			var _a = useState(null), status = _a[0], setStatus = _a[1];
			var _b = useState({}), selected = _b[0], setSelected = _b[1];
			var _c = useState(false), busy = _c[0], setBusy = _c[1];
			var _d = useState(false), open = _d[0], setOpen = _d[1];
			var _e = useState(""), notice = _e[0], setNotice = _e[1];
			var dismissedRef = useRef(false);
			var load = useCallback(function () {
				callApi("/ext/api/rescue/status").then(function (value) {
					setStatus(value);
					if (value && value.active) {
						// A dismissed dialog stays dismissed until the status
						// goes inactive and active again (e.g. another rescue).
						if (!dismissedRef.current) setOpen(true);
					} else {
						dismissedRef.current = false;
						setOpen(false);
					}
				}, function () { /* host not reachable yet — the next poll retries */ });
			}, []);
			useEffect(function () {
				load();
				var timer = window.setInterval(load, 5000);
				return function () { window.clearInterval(timer); };
			}, [load]);
			var dismiss = useCallback(function () {
				dismissedRef.current = true;
				setOpen(false);
			}, []);
			var toggleOne = useCallback(function (name) {
				setSelected(function (prev) {
					var next = Object.assign({}, prev);
					if (next[name] === true) delete next[name];
					else next[name] = true;
					return next;
				});
			}, []);
			var selectAll = useCallback(function () {
				var plugins = status && Array.isArray(status.plugins) ? status.plugins : [];
				var next = {};
				for (var index = 0; index < plugins.length; index++) next[plugins[index].name] = true;
				setSelected(next);
			}, [status]);
			var submit = useCallback(function (names) {
				if (busy) return;
				setBusy(true);
				setNotice("");
				callApi("/ext/api/rescue/apply", { enable: names }).then(function (value) {
					setBusy(false);
					if (value && value.reload === "process") {
						setNotice(t("rescueReloadProcess"));
					} else if (value && value.reload === "page") {
						setNotice(t("rescueReloadPage"));
						window.setTimeout(function () { window.location.reload(); }, 1500);
					} else {
						dismissedRef.current = true;
						setOpen(false);
						setStatus(null);
					}
				}, function (reason) {
					setBusy(false);
					setNotice(String(reason && reason.message ? reason.message : reason));
				});
			}, [busy, t]);
			if (!open || !status || !status.active) return null;
			var plugins = Array.isArray(status.plugins) ? status.plugins : [];
			var selectedCount = Object.keys(selected).filter(function (name) { return selected[name] === true; }).length;
			var description = t("rescueIntro") + (status.failure && typeof status.failure.message === "string" ? " " + t("rescueFailure") + ": " + status.failure.message : "");
			var list = plugins.length === 0
				? jsx("p", { className: "extc-empty", children: t("rescueEmpty") })
				: jsx("ul", { className: "extc-rescue-list", children: plugins.map(function (plugin) {
					var checked = selected[plugin.name] === true;
					return jsxs("li", { className: "extc-row", children: [
						jsx("label", { className: "extc-check", children: jsx("input", { type: "checkbox", checked: checked, disabled: busy, onChange: function () { toggleOne(plugin.name); } }) }),
						jsxs("div", { className: "extc-row-main", children: [
							jsx("span", { className: "extc-row-title", children: plugin.name }),
							jsx("span", { className: "extc-rescue-reason", children: rescueReasonLabel(t, plugin.reason) })
						] })
					] }, plugin.name);
				}) });
			return jsx(_primitives.Modal, {
				open: true,
				onClose: dismiss,
				title: t("rescueTitle"),
				closeLabel: t("rescueDismiss"),
				description: description,
				footer: jsxs("div", { className: "extc-actions", children: [
					notice ? jsx("span", { className: "extc-rescue-note", children: notice }) : null,
					jsx(Button, { disabled: busy || plugins.length === 0, onClick: selectAll, children: t("rescueRestoreAll") }),
					jsx(Button, { disabled: busy, onClick: function () { submit([]); }, children: t("rescueKeepDisabled") }),
					jsx(Button, { primary: true, busy: busy, disabled: busy || selectedCount === 0, onClick: function () { submit(Object.keys(selected).filter(function (name) { return selected[name] === true; })); }, children: t("rescueApplySelected") })
				] }),
				children: list
			});
		}
		/** The sidebar footer mount point: renders only the body-portaled dialog. */
		function RescueAction(props) {
			return jsx(RescueDialog, { t: props.t });
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		var NS = "ext-center";
		/** Required services (cordis fiber inject). */
		var inject = ["slots", "locale", "sessions", "workspaces"];
		/** The section entry: a settings.section list item with three tabs. */
		function ExtensionCenterSection(props) {
			var t = props.t;
			var _a = useState("skills"), tab = _a[0], setTab = _a[1];
			var tabs = [
				{ id: "skills", label: t("tabSkills") },
				{ id: "plugins", label: t("tabPlugins") },
				{ id: "mcp", label: t("tabMcp") },
				{ id: "tavily", label: t("tabTavily") },
				{ id: "github", label: t("tabGithub") },
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
				tab === "tavily" ? jsx(TavilyTab, { t: t, loadState: props.loadState }) : null,
				tab === "github" ? jsx(GitHubTab, { t: t, loadState: props.loadState }) : null,
				tab === "settings" ? jsx(SettingsTab, { t: t, loadState: props.loadState }) : null
			] });
		}
		//#region dsh-web-ui compatibility (inline mirror of src/compat.ts — keep in sync)
		/** The dsh-web-ui family registry: entry ids + package names → suppressed surfaces. */
		var DSH_WEB_UI_FAMILY = [
			{ key: "aionuiPanel", ids: ["ui-dsh-aionui-panel"], names: ["@linxin666/dsh-client-ui-aionui-panel"], suppresses: ["tree", "git"] },
			{ key: "gitGraph", ids: ["ui-git-graph"], names: ["@linxin666/dsh-client-ui-git-graph"], suppresses: ["git"] },
			{ key: "ssh", ids: ["ssh"], names: ["@linxin666/dsh-ssh"], suppresses: ["terminal"] },
			{ key: "describeImage", ids: ["describe-image"], names: ["@linxin666/dsh-tool-describe-image"], suppresses: ["vision"] }
		];
		/** One snapshot of the client loader tree (null when the loader is unavailable). */
		function clientLoaderState(ctx) {
			var loader;
			try {
				loader = ctx.get("loader");
			} catch (error) { /* loader inspection is best-effort */ }
			if (!loader || typeof loader.entries !== "function") return null;
			var settled = true;
			var views = [];
			try {
				for (var entry of loader.entries()) {
					if (entry.options && entry.options.group) continue;
					var fiberState = entry.fiber ? entry.fiber.state : void 0;
					views.push({
						id: String(entry.id || ""),
						name: String((entry.options && entry.options.name) || ""),
						fiberState: fiberState,
						disabled: entry.disabled === true
					});
					// PENDING(0)/LOADING(1) fibers are still converging; a decision
					// taken while a sibling is pending could double-register a
					// surface the family is about to own.
					if (entry.disabled !== true && (fiberState === void 0 || fiberState === 0 || fiberState === 1)) settled = false;
				}
			} catch (error) { return null; }
			// An empty tree is trivially settled.
			return { settled: settled, views: views };
		}
		/** Resolve once the client loader tree converged (or the timeout elapsed). */
		function waitForClientLoaderSettle(ctx, timeoutMs) {
			var started = Date.now();
			return new Promise(function (resolve) {
				var poll = function () {
					var state = clientLoaderState(ctx);
					// No loader at all: fail open, this plugin keeps its surfaces.
					if (state === null) return resolve({ settled: true, views: [] });
					if (state.settled) return resolve(state);
					if (Date.now() - started >= timeoutMs) return resolve(state);
					setTimeout(poll, 400);
				};
				poll();
			});
		}
		/** Which of our own surfaces the live dsh-web-ui family suppresses. */
		function clientDshWebUiSuppression(views) {
			var present = {};
			for (var view of views) {
				if (view.disabled === true || view.fiberState !== 2) continue;
				for (var member of DSH_WEB_UI_FAMILY) {
					if (member.ids.indexOf(view.id) !== -1 || member.names.indexOf(view.name) !== -1) {
						present[member.key] = true;
					}
				}
			}
			return {
				tree: present.aionuiPanel === true,
				git: present.aionuiPanel === true || present.gitGraph === true,
				terminal: present.ssh === true,
				vision: present.describeImage === true
			};
		}
		//#endregion
		/** Mount the Better DeepSeek Harness settings section. */
		function apply(ctx) {
			var t = ctx.locale.bind(NS);
			ctx.effect(function () {
				return ctx.locale.register(NS, { zh: zh, en: en });
			}, "ext-center: dictionaries");
			var loadState = function () {
				return callApi("/ext/api/state");
			};
			ctx.slots.inject("settings.section", function () {
				return ctx.slots.register({
					name: "settings.section",
					id: "ext-center",
					// Sits directly below the AGENT-presets section (order 20),
					// ahead of any later-registered sections (order 50+).
					order: 21,
					label: function () { return t("nav"); },
					locale: NS,
					inject: function () { return { loadState: loadState }; },
					children: {}
				}, ExtensionCenterSection);
			});
			ctx.slots.inject("sidebar.footer.action", function () {
				return ctx.slots.register({
					name: "sidebar.footer.action",
					id: "ext-center.rescue",
					order: 99,
					label: function () { return t("rescueTitle"); },
					locale: NS
				}, RescueAction);
			});
			ctx.slots.inject("sidebar.footer.action", function () {
				return ctx.slots.register({
					name: "sidebar.footer.action",
					id: "ext-center.archive",
					order: 10,
					label: function () { return t("archiveTrigger"); },
					locale: NS,
					inject: function () {
						var hooks = {};
						if (ctx.sessions && ctx.sessions.list) hooks.sessions = ctx.sessions.list;
						if (ctx.workspaces && ctx.workspaces.list) hooks.workspaces = ctx.workspaces.list;
						return { hooks: hooks };
					}
				}, ArchivedAction);
			});
			ctx.slots.inject("conversation.input.right", function () {
				return ctx.slots.register({
					name: "conversation.input.right",
					id: "ext-center.optimize-input",
					order: 20,
					locale: NS,
					inject: function (sessionId) {
						return {
							getCurrentModel: function () {
								var models = null;
								try { models = ctx.get("modelDirectories"); } catch (error) { models = null; }
								if (!models) return Promise.resolve(null);
								try {
									var directory = models.directoryFor(sessionId);
									var current = directory.store.getSnapshot().current;
									if (current) return Promise.resolve(current);
									return directory.load().then(function (value) { return value && value.current ? value.current : null; }, function () { return null; });
								} catch (error) {
									return Promise.resolve(null);
								}
							}
						};
					}
				}, OptimizeInputAction);
			});
			// The file tree, git tab and terminal tab are owned by the dsh-web-ui
			// family when it is installed (aionui-panel explorer/SCM, git-graph,
			// dsh-ssh) — see src/compat.ts. They register only once the loader
			// tree converged and only when the family does not own the same
			// element; every other surface stays unconditional.
			var registerTreeAction = function () {
				return ctx.slots.inject("sidebar.footer.action", function () {
					return ctx.slots.register({
						name: "sidebar.footer.action",
						id: "ext-center.tree",
						order: 20,
						label: function () { return t("treeTrigger"); },
						locale: NS
					}, TreeAction);
				});
			};
			var registerTerminalTab = function () {
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
				return ctx.slots.inject("conversation.view", function () {
					return ctx.slots.register({
						name: "conversation.view",
						id: "ext-center.terminal",
						order: 20,
						label: function () { return t("tabTerminals"); },
						locale: NS,
						inject: function () { return { themeDark: terminalDark, themeSubscribe: terminalThemeSubscribe }; }
					}, TerminalTab);
				});
			};
			var registerGitTab = function () {
				return ctx.slots.inject("conversation.view", function () {
					return ctx.slots.register({
						name: "conversation.view",
						id: "ext-center.git",
						order: 30,
						label: function () { return t("tabGit"); },
						locale: NS
					}, GitTab);
				});
			};
			ctx.effect(function () {
				var disposed = false;
				var disposers = [];
				var safeRegister = function (register) {
					try { return register(); } catch (error) {
						// A broken registration must never take the GUI down.
						try { ctx.logger?.warn?.("ext-center: surface registration failed", error); } catch (ignore) { }
						return function () { };
					}
				};
				var gate = waitForClientLoaderSettle(ctx, 8000).then(function (state) {
					if (disposed) return;
					var suppression = clientDshWebUiSuppression(state.views);
					if (!suppression.tree) disposers.push(safeRegister(registerTreeAction));
					if (!suppression.git) disposers.push(safeRegister(registerGitTab));
					if (!suppression.terminal) disposers.push(safeRegister(registerTerminalTab));
				});
				gate.catch(function (error) {
					// Fail-open: a broken gate must never hide our surfaces.
					if (disposed) return;
					try { ctx.logger?.warn?.("ext-center: dsh-web-ui gate failed", error); } catch (ignore) { }
					if (!disposers.length) {
						disposers.push(safeRegister(registerTreeAction));
						disposers.push(safeRegister(registerGitTab));
						disposers.push(safeRegister(registerTerminalTab));
					}
				});
				return function () {
					disposed = true;
					for (var i = disposers.length - 1; i >= 0; i--) {
						try { disposers[i](); } catch (error) { /* a slot disposer must not break unload */ }
					}
					disposers.length = 0;
				};
			}, "ext-center: dsh-web-ui compatibility gate");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
