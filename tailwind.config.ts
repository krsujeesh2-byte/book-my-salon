import type { Config } from 'tailwindcss';

/**
 * Book My Salon brand tokens.
 * Source: brand kit provided 2026-08-13 (logo, color palette, Poppins typeface).
 * Keep this file as the single source of truth for brand colors/fonts —
 * do not hardcode hex values elsewhere in components.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#0A0A0A', // primary dark / text on light surfaces
          green: '#6BC24A', // primary accent, CTAs, active states
          'green-dark': '#559B3B', // hover/pressed state for green
          'green-light': '#EAF7E4', // tinted backgrounds, badges
          white: '#FFFFFF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F6F7F6',
          border: '#E5E7E5',
        },
        ink: {
          DEFAULT: '#0A0A0A',
          muted: '#5B615C',
          faint: '#9AA09B',
        },
        state: {
          success: '#2E9E4F',
          warning: '#D68A1E',
          danger: '#D14343',
          info: '#3B7DD8',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,10,10,0.04), 0 4px 16px rgba(10,10,10,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
