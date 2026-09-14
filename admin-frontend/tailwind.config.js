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
        tuuci: {
          dark: '#111315',
          card: '#ffffff',
          darkCard: '#1a1d20',
          accent: '#0284c7',
          border: '#e5e7eb',
          darkBorder: '#272b30'
        }
      }
    },
  },
  plugins: [],
}
