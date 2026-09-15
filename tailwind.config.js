/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta azul/branco inspirada no iOS
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#0a84ff', // azul iOS primário
          700: '#0060df',
          800: '#0048a8',
          900: '#003375',
        },
        ink: {
          DEFAULT: '#1c1c1e',
          soft: '#48484a',
          faint: '#8e8e93',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f6f8',
          sunken: '#eceef1',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        float: '0 10px 30px -12px rgba(16,24,40,0.25)',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
