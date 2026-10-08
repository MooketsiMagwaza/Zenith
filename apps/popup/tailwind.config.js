/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  safelist: [
    // Ensure critical classes are never purged
    'micro-caps', 'timer-mono', 'pulse-gold', 'fade-in', 'display-italic',
    'card-soft', 'gold-rule', 'markdown-body',
    'bg-[#050505]', 'text-[#ece9e3]', 'border-[#1a1a1a]',
    'text-[#c9a84c]', 'bg-[#c9a84c]', 'text-[#000000]'
  ],
  theme: {
    extend: {
      colors: { 
        background: '#000000', 
        foreground: '#ece9e3', 
        'surface-1': '#060606', 
        'surface-2': '#0a0a0a', 
        'surface-3': '#111111', 
        border: '#1a1a1a', 
        'border-accent': '#2c2c2c', 
        'text-secondary': '#7a7a7a', 
        'text-dim': '#4a4a4a', 
        'accent-gold': '#c9a84c', 
        'accent-gold-dim': '#6e5524' 
      },
      fontFamily: { 
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'] 
      }
    }
  },
  plugins: []
}
