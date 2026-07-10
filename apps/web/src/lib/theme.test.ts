import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEffectiveTheme, applyThemeToDocument, persistTheme, THEME_STORAGE_KEY } from './theme';

describe('theme logic', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.className = '';
  });

  it('valid saved dark wins over light system', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dark');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false })); // system light
    expect(getEffectiveTheme()).toBe('dark');
  });

  it('valid saved light wins over dark system', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('light');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true })); // system dark
    expect(getEffectiveTheme()).toBe('light');
  });

  it('dark system used with no saved preference', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(getEffectiveTheme()).toBe('dark');
  });

  it('light system used with no saved preference', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(getEffectiveTheme()).toBe('light');
  });

  it('invalid saved value is ignored', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('purple');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(getEffectiveTheme()).toBe('dark');
  });

  it('explicit toggle applies correct root class', () => {
    applyThemeToDocument('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyThemeToDocument('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('explicit toggle persists preference', () => {
    persistTheme('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
  });
});
