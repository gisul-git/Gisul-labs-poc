/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#4f6ef7', 600: '#3b55e6' },
      },
    },
  },
  plugins: [],
};
