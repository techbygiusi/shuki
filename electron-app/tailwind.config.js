/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          bg: 'var(--bg-primary)',
          'bg-sec': 'var(--bg-secondary)',
          card: 'var(--bg-card)',
        },
        accent: {
          yellow: '#F5C842',
          purple: '#7C5CBF',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        bdr: 'var(--border)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
