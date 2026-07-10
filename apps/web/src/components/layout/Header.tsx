'use client';

import { Sun, Moon, Github } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Link from 'next/link';

export function Header() {
  const { theme, mounted, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg font-semibold text-primary tracking-tight">Importlyai</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/guptakaran20/GrowEasyIntern"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-muted hover:bg-surface-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
            title="View on GitHub"
            aria-label="View on GitHub"
          >
            <Github size={20} />
          </a>
          {mounted && (
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted hover:bg-surface-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
