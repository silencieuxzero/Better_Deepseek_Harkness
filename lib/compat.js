/**
 * dsh-web-ui compatibility decisions — pure logic.
 *
 * The dsh-web-ui family (https://github.com/zhu1090093659/dsh-web-ui) ships
 * its own file tree (aionui-panel explorer), git surfaces (aionui-panel SCM,
 * git-graph branch chip / graph) and web terminal (dsh-ssh), plus image
 * understanding (dsh-tool-describe-image). When one of those plugins is
 * ACTIVE in the same profile, this plugin stands down the corresponding
 * surface so the two never fight over the same UI element: dsh-web-ui owns
 * the feature and our duplicate stays inert.
 *
 * No I/O: the host half feeds loader-entry views in and reads a suppression
 * decision out. The browser half cannot import this module (the client is a
 * standalone bundle), so `src/client.js` carries an inline copy of the family
 * table — keep the two in sync (tests/compat-client.spec.ts guards it).
 */
/** Cordis fiber state: ACTIVE === 2 (see @deepseek-ai/cordis FiberState). */
export const FIBER_STATE_ACTIVE = 2;
/** The dsh-web-ui family registry (mirrored inline in `src/client.js`). */
export const DSH_WEB_UI_FAMILY = [
    {
        key: 'aionuiPanel',
        ids: ['ui-dsh-aionui-panel'],
        names: ['@linxin666/dsh-client-ui-aionui-panel'],
        suppresses: ['tree', 'git'],
    },
    {
        key: 'gitGraph',
        ids: ['ui-git-graph'],
        names: ['@linxin666/dsh-client-ui-git-graph'],
        suppresses: ['git'],
    },
    {
        key: 'ssh',
        ids: ['ssh'],
        names: ['@linxin666/dsh-ssh'],
        suppresses: ['terminal'],
    },
    {
        key: 'describeImage',
        ids: ['describe-image'],
        names: ['@linxin666/dsh-tool-describe-image'],
        suppresses: ['vision'],
    },
];
/** A presence snapshot with every family plugin absent. */
export function emptyDshWebUiPresence() {
    return { aionuiPanel: false, gitGraph: false, ssh: false, describeImage: false };
}
/** True when one entry counts as a live family member (ACTIVE and not disabled). */
export function compatEntryActive(view) {
    return view.disabled !== true && view.fiberState === FIBER_STATE_ACTIVE;
}
/**
 * Detect which dsh-web-ui family plugins are live in a loader-entry view set.
 * Only ACTIVE (and not disabled) entries count: a pending or failed sibling
 * renders no element, so this plugin keeps its own surface in that case.
 */
export function detectDshWebUi(entries) {
    const present = emptyDshWebUiPresence();
    for (const view of entries) {
        if (!view || !compatEntryActive(view))
            continue;
        const id = String(view.id ?? '');
        const name = String(view.name ?? '');
        for (const member of DSH_WEB_UI_FAMILY) {
            if (member.ids.includes(id) || member.names.includes(name)) {
                present[member.key] = true;
            }
        }
    }
    return present;
}
/** Which of this plugin's own surfaces to suppress for a detected presence. */
export function dshWebUiSuppression(presence) {
    return {
        tree: presence.aionuiPanel,
        git: presence.aionuiPanel || presence.gitGraph,
        terminal: presence.ssh,
        vision: presence.describeImage,
    };
}
