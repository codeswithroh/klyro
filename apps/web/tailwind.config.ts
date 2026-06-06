import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand tokens (mirrors CSS variables)
        paper: '#EEEDF2',
        'paper-2': '#E6E5EC',
        surface: '#FFFFFF',
        ink: '#131119',
        'ink-2': '#565463',
        'ink-3': '#8B8995',
        line: '#E0DFE8',
        'line-2': '#D2D1DC',

        sig: '#6C2BF2',
        'sig-2': '#9A6BFF',
        'sig-ink': '#3B1690',
        'sig-wash': '#EDE6FF',

        up: '#07BE6A',
        'up-ink': '#04713F',
        'up-wash': '#DBF7E9',

        down: '#F12E49',
        'down-ink': '#97122A',
        'down-wash': '#FDE2E6',
      },
      fontFamily: {
        display: ['Archivo Expanded', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '14px',
        lg: '22px',
        xl: '32px',
      },
      boxShadow: {
        sm: '0 1px 0 rgba(19,17,25,.04), 0 2px 6px rgba(19,17,25,.05)',
        DEFAULT: '0 2px 4px rgba(19,17,25,.04), 0 12px 28px rgba(19,17,25,.08)',
        lg: '0 8px 18px rgba(19,17,25,.07), 0 30px 60px rgba(19,17,25,.12)',
        sig: '0 16px 40px rgba(108,43,242,.28)',
      },
      animation: {
        'spin-slow': 'spin 26s linear infinite',
        pulse: 'pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
