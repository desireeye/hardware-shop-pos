/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7f8',
          100: '#e6ecee',
          500: '#1f6f8b',
          600: '#1a5d77',
          700: '#104d63',
          800: '#0d3d4f',
        },
        accent: {
          500: '#f59e0b',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
