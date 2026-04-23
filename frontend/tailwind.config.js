/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './stores/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      colors: {
        border: 'hsl(var(--border))', // Match admin --crm-border: #30363d
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))', // Match admin --crm-bg: #0d1117
        foreground: 'hsl(var(--foreground))', // Match admin --crm-text: #c9d1d9
        primary: {
          DEFAULT: 'hsl(var(--primary))', // Match admin --crm-primary: #1f6feb
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))', // Match admin --crm-bg-card: #21262d
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: '#238636', // Match admin --crm-success
        warning: '#d29922', // Match admin --crm-warning
        danger: '#da3633', // Match admin --crm-danger
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        bengali: ['var(--font-bengali)', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'soft-md': '0 4px 16px -4px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.05)',
        'soft-lg': '0 8px 32px -8px rgba(0,0,0,0.12), 0 4px 8px -4px rgba(0,0,0,0.06)',
        'glow-primary': '0 0 20px -4px hsl(var(--primary) / 0.3)',
      },
      keyframes: {
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'tracking-wave-flow': {
          '0%':   { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-32' },
        },
        'tracking-boat-bob': {
          '0%, 100%': { transform: 'translateX(-50%) translateY(-50%)' },
          '50%':       { transform: 'translateX(-50%) translateY(calc(-50% - 3px))' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-up': 'slide-in-up 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'tracking-wave-flow': 'tracking-wave-flow 1.8s linear infinite',
        'tracking-boat-bob': 'tracking-boat-bob 2.4s ease-in-out infinite',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      scale: {
        '108': '1.08',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
