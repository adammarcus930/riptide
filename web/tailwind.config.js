import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo Variable', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        cta: '0 10px 30px rgba(0, 0, 0, 0.5)',
      },
      colors: {
        base: '#0D1013',
        card: '#161B21',
        input: '#1C232B',
        accent: '#43C9FF',
        'on-accent': '#04141D',
        ink: '#EEF3F7',
        'ink-dim': 'rgba(238,243,247,0.5)',
        'ink-faint': 'rgba(238,243,247,0.45)',
        stroke: 'rgba(255,255,255,0.08)',
        'stroke-strong': 'rgba(255,255,255,0.12)',
        'stroke-dashed': 'rgba(255,255,255,0.22)',
      },
      borderRadius: { card: '18px', btn: '14px' },
    },
  },
  plugins: [],
};
