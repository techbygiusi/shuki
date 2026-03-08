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
          primary: 'var(--accent-primary)',
          soft: 'var(--accent-soft)',
          purple: '#7C5CBF',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        bdr: 'var(--border)',
      },
      fontFamily: {
        display: ['Lora', 'serif'],
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(80,50,20,0.10)',
      },
    },
  },
  plugins: [],
};
