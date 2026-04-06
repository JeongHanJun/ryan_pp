import { create } from 'zustand';

const useLangStore = create((set) => ({
  lang: localStorage.getItem('p4_lang') || 'kr',
  setLang: (lang) => {
    localStorage.setItem('p4_lang', lang);
    set({ lang });
  },
  toggleLang: () =>
    set((state) => {
      const next = state.lang === 'kr' ? 'en' : 'kr';
      localStorage.setItem('p4_lang', next);
      return { lang: next };
    }),
}));

export default useLangStore;
