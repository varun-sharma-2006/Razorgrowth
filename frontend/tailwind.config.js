import animate from 'tailwindcss-animate'

// RazorGrowth design system: a midnight canvas with aurora light, electric violet → cyan accents,
// Bricolage Grotesque headlines over Geist, and Geist Mono for live figures.

const night = {
  // cool text → midnight surfaces
  50: '#f7f8fc',
  100: '#eceef8', // primary text
  200: '#d4d8ea',
  300: '#b3b9d3',
  400: '#8a91b0', // secondary text
  500: '#646b8a', // muted
  600: '#454b66',
  700: '#2c3150', // strong lines
  800: '#1a1e36', // hairlines
  900: '#0f1224', // raised surface
  950: '#080a17' // canvas
}

const brand = {
  50: '#f2efff',
  100: '#e6e0ff',
  200: '#cfc4ff',
  300: '#b3a2ff',
  400: '#977fff',
  500: '#7c5cff', // electric violet
  600: '#6a45f5',
  700: '#5634d6',
  800: '#4129a6',
  900: '#2c1d70',
  950: '#170f3d'
}

const aqua = {
  200: '#a5f0fc',
  300: '#67e3f9',
  400: '#22d3ee',
  500: '#0ea5c6',
  600: '#0b86a3'
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
        slate: night,
        night,
        brand,
        indigo: brand,
        violet: brand,
        purple: brand,
        cyan: aqua,
        sky: aqua,
        aqua,
        emerald: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 950: '#022c22' },
        rose: { 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 950: '#2a0a12' }
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', '"Geist Variable"', 'sans-serif'],
        mono: ['"Geist Mono Variable"', '"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      keyframes: {
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        'aurora': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.06)' }
        },
        'feed-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'ping-soft': {
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' }
        }
      },
      animation: {
        'float-y': 'float-y 6s ease-in-out infinite',
        'aurora': 'aurora 18s ease-in-out infinite',
        'feed-in': 'feed-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'ping-soft': 'ping-soft 1.8s cubic-bezier(0, 0, 0.2, 1) infinite'
      }
    },
  },
  plugins: [animate],
}
