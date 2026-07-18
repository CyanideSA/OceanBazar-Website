/** @type {import('tailwindcss').Config} */

// crm-* colors resolve to CSS variables defined in src/styles/crm-tokens.css.
// The -rgb variables hold "R G B" channels so the <alpha-value> placeholder
// lets utilities like bg-crm-primary/10 keep working while the active theme
// (data-crm-theme) drives the actual color.
// The -dim colors are pre-baked translucent tints consumed as-is.
const c = (name) => `rgb(var(--crm-${name}-rgb) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        'crm-bg': c('bg'),
        'crm-bg-alt': c('bg-alt'),
        'crm-bg-card': c('bg-card'),
        'crm-bg-hover': c('bg-hover'),
        'crm-surface': c('surface'),
        'crm-surface-2': c('surface-2'),

        // Borders
        'crm-border': c('border'),
        'crm-border-subtle': c('border-subtle'),
        'crm-border-strong': c('border-strong'),

        // Text
        'crm-text': c('text'),
        'crm-text-dim': c('text-dim'),
        'crm-text-bright': c('text-bright'),
        'crm-text-muted': c('text-muted'),

        // Accents
        'crm-primary': c('primary'),
        'crm-primary-hover': c('primary-hover'),
        'crm-primary-dim': 'var(--crm-primary-dim)',

        'crm-success': c('success'),
        'crm-success-hover': c('success-hover'),
        'crm-success-dim': 'var(--crm-success-dim)',

        'crm-warning': c('warning'),
        'crm-warning-hover': c('warning-hover'),
        'crm-warning-dim': 'var(--crm-warning-dim)',

        'crm-danger': c('danger'),
        'crm-danger-hover': c('danger-hover'),
        'crm-danger-dim': 'var(--crm-danger-dim)',

        'crm-purple': c('purple'),
        'crm-cyan': c('cyan'),
      },
    },
  },
  plugins: [],
};
