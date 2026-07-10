import { useEffect, useState } from 'react';
import { Theme, applyThemeToDocument, getEffectiveTheme, persistTheme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setThemeState(getEffectiveTheme());
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    applyThemeToDocument(newTheme);
    persistTheme(newTheme);
  };

  return { theme, mounted, toggleTheme };
}
