// Shared regex + helpers for highlighting {{variable}} references in user
// inputs (URL, headers, query params, body editor).

import { Decoration, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from '@codemirror/view';

export const VAR_REGEX = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * CodeMirror extension that wraps `{{name}}` in a styled span. Pair with the
 * `.cm-volt-var` rule in global.css.
 */
export const voltVarHighlight = ViewPlugin.fromClass(
  class {
    decorations;
    matcher = new MatchDecorator({
      regexp: VAR_REGEX,
      decoration: () => Decoration.mark({ class: 'cm-volt-var' }),
    });
    constructor(view: EditorView) {
      this.decorations = this.matcher.createDeco(view);
    }
    update(u: ViewUpdate) {
      this.decorations = this.matcher.updateDeco(u, this.decorations);
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
