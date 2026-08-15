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
export const FIBER_STATE_ACTIVE = 2

/** One family plugin as the loader sees it, normalized on both halves. */
export interface CompatEntryView {
  /** Loader entry id (patch row id on the host; generated on the client). */
  id: string
  /** Module specifier / package name, when the entry carries one. */
  name?: string
  /** Cordis fiber state; absent means the fiber never started. */
  fiberState?: number
  /** True when the entry (or an owning parent) is disabled. */
  disabled?: boolean
}

/** One dsh-web-ui family plugin identity. */
export interface DshWebUiMember {
  /** Presence key (also the flag name on {@link DshWebUiPresence}). */
  key: 'aionuiPanel' | 'gitGraph' | 'ssh' | 'describeImage'
  /** Loader entry ids the family plugin is installed under. */
  ids: readonly string[]
  /** npm package names the family plugin ships as. */
  names: readonly string[]
  /** This plugin's surfaces that the family plugin supersedes. */
  suppresses: readonly ('tree' | 'git' | 'terminal' | 'vision')[]
}

/** Which dsh-web-ui family plugins are live in the current loader tree. */
export interface DshWebUiPresence {
  /** @linxin666/dsh-client-ui-aionui-panel — right-panel explorer + SCM. */
  aionuiPanel: boolean
  /** @linxin666/dsh-client-ui-git-graph — branch selector + git graph. */
  gitGraph: boolean
  /** @linxin666/dsh-ssh — remote web terminal panel. */
  ssh: boolean
  /** @linxin666/dsh-tool-describe-image — image understanding. */
  describeImage: boolean
}

/** Which of this plugin's own surfaces to suppress. */
export interface DshWebUiSuppression {
  /** Sidebar file tree (`ext-center.tree`) — superseded by aionui-panel explorer. */
  tree: boolean
  /** Conversation Git tab (`ext-center.git`) — superseded by aionui-panel SCM / git-graph. */
  git: boolean
  /** Conversation Terminal tab (`ext-center.terminal`) — superseded by dsh-ssh. */
  terminal: boolean
  /** Host-side image transcription (llm/stream + capability bridge) — superseded by describe-image. */
  vision: boolean
}

/** The dsh-web-ui family registry (mirrored inline in `src/client.js`). */
export const DSH_WEB_UI_FAMILY: readonly DshWebUiMember[] = [
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
]

/** A presence snapshot with every family plugin absent. */
export function emptyDshWebUiPresence(): DshWebUiPresence {
  return { aionuiPanel: false, gitGraph: false, ssh: false, describeImage: false }
}

/** True when one entry counts as a live family member (ACTIVE and not disabled). */
export function compatEntryActive(view: CompatEntryView): boolean {
  return view.disabled !== true && view.fiberState === FIBER_STATE_ACTIVE
}

/**
 * Detect which dsh-web-ui family plugins are live in a loader-entry view set.
 * Only ACTIVE (and not disabled) entries count: a pending or failed sibling
 * renders no element, so this plugin keeps its own surface in that case.
 */
export function detectDshWebUi(entries: Iterable<CompatEntryView>): DshWebUiPresence {
  const present = emptyDshWebUiPresence()
  for (const view of entries) {
    if (!view || !compatEntryActive(view)) continue
    const id = String(view.id ?? '')
    const name = String(view.name ?? '')
    for (const member of DSH_WEB_UI_FAMILY) {
      if (member.ids.includes(id) || member.names.includes(name)) {
        present[member.key] = true
      }
    }
  }
  return present
}

/** Which of this plugin's own surfaces to suppress for a detected presence. */
export function dshWebUiSuppression(presence: DshWebUiPresence): DshWebUiSuppression {
  return {
    tree: presence.aionuiPanel,
    git: presence.aionuiPanel || presence.gitGraph,
    terminal: presence.ssh,
    vision: presence.describeImage,
  }
}
