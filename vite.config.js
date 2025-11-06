import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build with relative paths so the site works when served from GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
})
