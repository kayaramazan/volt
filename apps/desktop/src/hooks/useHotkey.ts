// Lightweight keyboard shortcut hook.
//
// Conventions:
//   - "mod" = Cmd on macOS, Ctrl elsewhere (matches platform feel)
//   - Combos use "+" e.g. "mod+k", "mod+enter", "mod+shift+p"
//   - Only fires when the user is NOT typing in an editable element
//     (input/textarea/contenteditable) unless allowInInputs is true.

import { useEffect } from 'react';

export interface HotkeyOptions {
  allowInInputs?: boolean;
  /** Don't preventDefault — useful if you want the original behavior to also happen */
  preventDefault?: boolean;
}

export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  const { allowInInputs = false, preventDefault = true } = options;

  useEffect(() => {
    const parts = combo.toLowerCase().split('+').map((p) => p.trim());
    const wantMod = parts.includes('mod');
    const wantShift = parts.includes('shift');
    const wantAlt = parts.includes('alt');
    const wantCtrl = parts.includes('ctrl');
    const key = parts.find((p) => !['mod', 'shift', 'alt', 'ctrl'].includes(p))!;

    const isMac = navigator.platform.toLowerCase().includes('mac');

    function listener(event: KeyboardEvent) {
      const modPressed = isMac ? event.metaKey : event.ctrlKey;
      if (wantMod && !modPressed) return;
      if (wantCtrl && !event.ctrlKey) return;
      if (wantShift !== event.shiftKey) return;
      if (wantAlt !== event.altKey) return;
      if (event.key.toLowerCase() !== key) return;

      if (!allowInInputs && isEditableTarget(event.target)) return;

      if (preventDefault) event.preventDefault();
      handler(event);
    }

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [combo, handler, allowInInputs, preventDefault]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}
