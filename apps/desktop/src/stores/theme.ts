// Theme preference: System | Light | Dark. Mirrors the toggle in Settings.
// Applies a class on <html> so the CSS vars in global.css switch.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';

interface ThemeState {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  const effective = pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
  root.classList.add(effective);
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      pref: 'system',
      setPref: (p) => {
        apply(p);
        set({ pref: p });
      },
    }),
    {
      name: 'volt:theme',
      onRehydrateStorage: () => (state) => {
        if (state) apply(state.pref);
      },
    },
  ),
);

// Live-update when the OS preference flips while we're on "system".
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useTheme.getState().pref === 'system') apply('system');
  });
}

// Apply once at module load in case rehydration races the first render.
apply(useTheme.getState().pref);
