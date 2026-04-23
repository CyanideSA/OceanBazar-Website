/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        'crm-bg': '#0d1117',
        'crm-bg-alt': '#161b22',
        'crm-bg-card': '#21262d',
        'crm-bg-hover': '#30363d',

        // Borders
        'crm-border': '#30363d',
        'crm-border-subtle': '#21262d',
        'crm-border-strong': '#484f58',

        // Text
        'crm-text': '#c9d1d9',
        'crm-text-dim': '#8b949e',
        'crm-text-bright': '#f0f6fc',
        'crm-text-muted': '#484f58',

        // Accents
        'crm-primary': '#1f6feb',
        'crm-primary-hover': '#388bfd',
        'crm-primary-dim': '#1f6feb22',

        'crm-success': '#238636',
        'crm-success-hover': '#2ea043',
        'crm-success-dim': '#23863622',

        'crm-warning': '#d29922',
        'crm-warning-hover': '#e3b341',
        'crm-warning-dim': '#d2992222',

        'crm-danger': '#da3633',
        'crm-danger-hover': '#f85149',
        'crm-danger-dim': '#da363322',
      },
    },
  },
  plugins: [],
};
