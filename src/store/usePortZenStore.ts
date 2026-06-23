import { create } from 'zustand';
import type { TemplateFilter } from '../types';

type Theme = 'light' | 'dark';

interface PortZenState {
  activeFilter: TemplateFilter;
  magicLink: string;
  theme: Theme;
  setActiveFilter: (filter: TemplateFilter) => void;
  setMagicLink: (link: string) => void;
  clearMagicLink: () => void;
  toggleTheme: () => void;
}

export const usePortZenStore = create<PortZenState>((set) => ({
  activeFilter: 'All',
  magicLink: '',
  theme: (localStorage.getItem('portzen-theme') as Theme) ?? 'light',
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setMagicLink: (magicLink) => set({ magicLink }),
  clearMagicLink: () => set({ magicLink: '' }),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('portzen-theme', next);
      return { theme: next };
    }),
}));
