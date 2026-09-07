/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fond: '#07080D',
        encre: '#EDEFF4',
        doux: '#8B93A5',
        pale: '#5F677A',
        cyan: '#22D3EE',
        iris: '#818CF8',
        menthe: '#34D399',
        or: '#FBBF24',
        corail: '#F87171',
        panneau: 'rgba(255,255,255,0.045)',
        panneauFort: 'rgba(255,255,255,0.07)',
        trait: 'rgba(255,255,255,0.09)',
        traitFort: 'rgba(255,255,255,0.16)',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"Azeret Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl2: '18px' },
    },
  },
  plugins: [],
};
