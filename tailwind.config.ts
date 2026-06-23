import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink:     'rgb(var(--c-ink) / <alpha-value>)',
        panel:   'rgb(var(--c-panel) / <alpha-value>)',
        line:    'rgb(var(--c-line) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        sage:    'rgb(var(--c-sage) / <alpha-value>)',
        forest:  'rgb(var(--c-forest) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 80px rgb(var(--c-primary) / 0.28)',
      },
    },
  },
  plugins: [],
} satisfies Config;
