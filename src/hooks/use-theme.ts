import { useState, useEffect, useCallback } from 'react';
type Theme = 'light' | 'dark' | 'auto';
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('theme') as Theme) || 'auto';
    } catch (e) {
      return 'auto';
    }
  });
  const applyTheme = useCallback((selectedTheme: Theme) => {
    if (selectedTheme === 'auto') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', systemTheme === 'dark');
    } else {
      document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
    }
  }, []);
  useEffect(() => {
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'auto') {
        applyTheme('auto');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);
  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      console.error('Failed to save theme to localStorage', e);
    }
    setThemeState(newTheme);
  };
  return { theme, setTheme };
}