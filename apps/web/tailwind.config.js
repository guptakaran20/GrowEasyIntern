/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
          hover: 'var(--color-surface-hover)',
        },
        border: 'var(--color-border)',
        primary: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        
        groeasy: {
          primary: 'var(--color-primary)',
          accent: 'var(--color-accent)',
          sidebar: 'var(--color-sidebar)', // legacy token from previous setup
        },
        
        success: {
          bg: 'var(--color-success-bg)',
          text: 'var(--color-success-text)',
          border: 'var(--color-success-border)',
        },
        warning: {
          bg: 'var(--color-warning-bg)',
          text: 'var(--color-warning-text)',
          border: 'var(--color-warning-border)',
        },
        error: {
          bg: 'var(--color-error-bg)',
          text: 'var(--color-error-text)',
          border: 'var(--color-error-border)',
        },
        info: {
          bg: 'var(--color-info-bg)',
          text: 'var(--color-info-text)',
          border: 'var(--color-info-border)',
        },
      },
    },
  },
  plugins: [],
};
