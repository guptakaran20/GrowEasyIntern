/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        groeasy: {
          primary: '#f97316',
          accent: '#14b8a6',
          sidebar: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
};
