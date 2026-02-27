import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0F172A',
        accent: '#1777FF',
        background: '#FFFFFF',
        'text-primary': '#1F1F1F',
        'text-secondary': '#6B7280',
        border: '#F2F2F2',
        success: '#10B981',
        error: '#EF4444',
      },
      borderRadius: {
        'capsule': '9999px',
      },
    },
  },
  plugins: [],
}
export default config
