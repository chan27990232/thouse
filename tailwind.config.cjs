/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#000000',
        secondary: '#ffffff'
      },
      maxWidth: {
        mobile: '448px'
      }
    }
  },
  plugins: []
};

