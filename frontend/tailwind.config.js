import animate from 'tailwindcss-animate'

// Design system shared with the Algo Trade Simulator: deep ink surfaces, champagne gold,
// ivory text, Playfair Display headings over Inter. Tailwind's stock palettes are remapped
// so existing utility classes (slate-*, indigo-*, ...) render in this theme.

const ink = {
  // warm ivory text → deep ink surfaces
  50: '#faf6ee',
  100: '#eee8dc', // --text
  200: '#ddd6c8',
  300: '#c5beb0',
  400: '#a29c90', // --text-muted
  500: '#7a756c', // --text-faint
  600: '#56534d',
  700: '#33322f', // stronger lines
  800: '#1f2028', // --line on ink
  900: '#11131c', // --surface-solid
  950: '#090a10' // --ink
}

const gold = {
  50: '#fdf8ec',
  100: '#f9ecd0',
  200: '#f3dca6', // --gold-light
  300: '#ebcc8c',
  400: '#e3c27f',
  500: '#d4af6a', // --gold
  600: '#b8924e',
  700: '#9c7535', // --gold-deep
  800: '#7a5a27',
  900: '#4f3a19',
  950: '#2e220f'
}

const info = {
  200: '#cfe0ff',
  300: '#a9c7ff',
  400: '#8fb7ff', // --info
  500: '#6f9be8',
  600: '#5b8fe6'
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: ink,
        indigo: gold,
        violet: gold,
        purple: gold,
        cyan: info,
        sky: info,
        emerald: { 300: '#8fe3b9', 400: '#5fd49a', 500: '#3fbf82', 600: '#2f9e6a', 950: '#0d2a1d' }, // --up
        rose: { 200: '#f8c4c4', 300: '#f6b3b3', 400: '#f07a7a', 500: '#e05f5f', 950: '#2c1012' }, // --down
        ink,
        gold
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Playfair Display Variable"', '"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        gold: '0 10px 30px -10px rgba(212, 175, 106, 0.55)',
        surface: '0 24px 60px -24px rgba(0, 0, 0, 0.75), 0 1px 0 rgba(255, 255, 255, 0.03) inset'
      }
    },
  },
  plugins: [animate],
}
