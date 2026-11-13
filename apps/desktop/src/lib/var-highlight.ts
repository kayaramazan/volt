// Shared regex + helpers for highlighting {{variable}} references in user
// inputs (URL, headers, query params, body editor).

import { Decoration, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { VAR_REGEX } from './variables';

export { VAR_REGEX };

// ── Resolver bridge ───────────────────────────────────────────────────────
// CodeMirror decorations can't read React context, so VariablesProvider
// pushes a "is this name resolved?" predicate here. Every mounted editor is
// re-decorated when it changes (env switch, variable edit, …).
let resolverVersion = 0;
// Until a provider mounts, treat everything as resolved (no false reds).
let isResolved: (name: string) => boolean = () => true;
const liveViews = new Set<EditorView>();

export function setVarResolver(fn: (name: string) => boolean) {
  isResolved = fn;
  resolverVersion++;
  for (const view of liveViews) {
    try {
      // Empty transaction → plugin.update() runs and notices the new version.
      view.dispatch({});
    } catch {
      /* view mid-update or destroyed — it will repaint on its next update */
    }
  }
}

const UNRESOLVED_STYLE =
  'color: rgb(var(--color-error)); background: rgb(var(--color-error) / 0.12); text-decoration: underline dotted;';

function makeMatcher() {
  return new MatchDecorator({
    regexp: VAR_REGEX,
    decoration: (m) =>
      isResolved(m[1] ?? '')
        ? Decoration.mark({ class: 'cm-volt-var' })
        : Decoration.mark({
            class: 'cm-volt-var cm-volt-var-unresolved',
            attributes: { style: UNRESOLVED_STYLE, title: 'Unresolved variable' },
          }),
  });
}

/**
 * CodeMirror extension that wraps `{{name}}` in a styled span (red when the
 * name doesn't resolve in the current scopes). Pair with the `.cm-volt-var`
 * rule in global.css. Hovers on these spans are caught by CodeEditor.tsx
 * (domEventHandlers) which opens the inline VarEditor popup.
 */
export const voltVarHighlight = ViewPlugin.fromClass(
  class {
    decorations;
    matcher = makeMatcher();
    version = resolverVersion;
    constructor(private view: EditorView) {
      this.decorations = this.matcher.createDeco(view);
      liveViews.add(view);
    }
    update(u: ViewUpdate) {
      if (this.version !== resolverVersion) {
        this.version = resolverVersion;
        this.decorations = this.matcher.createDeco(u.view);
      } else {
        this.decorations = this.matcher.updateDeco(u, this.decorations);
      }
    }
    destroy() {
      liveViews.delete(this.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/**
 * Split a string into alternating plain-text / variable-name segments.
 * Used by HighlightedInput to render the overlay.
 */
export function splitByVars(s: string): Array<{ text: string; isVar: boolean }> {
  if (!s) return [{ text: '', isVar: false }];
  const out: Array<{ text: string; isVar: boolean }> = [];
  const re = new RegExp(VAR_REGEX.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), isVar: false });
    out.push({ text: m[0], isVar: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), isVar: false });
  return out;
}
