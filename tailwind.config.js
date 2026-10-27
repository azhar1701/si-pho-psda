/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { navy: { DEFAULT: '#0f172a', 800: '#1e293b' } },
    },
  },
  plugins: [],
};
