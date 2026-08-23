/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff4ff',
          100: '#dce8ff',
          200: '#bad1ff',
          300: '#87afff',
          400: '#4d82f8',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1a44c0',
          800: '#1e3a8a',
          900: '#1e2f6e',
        },
        surface: {
          DEFAULT: '#eef2f7',
          50:  '#f8fafc',
          100: '#ffffff',
          200: '#f1f5f9',
          300: '#e2e8f0',
          400: '#cbd5e1',
          500: '#94a3b8',
        }
      },
    },
  },
  plugins: [],
}
