import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// `base` é ajustado no build para funcionar no GitHub Pages (/<repo>/).
// Em dev fica em '/'. Defina VITE_BASE ao publicar (ex.: "/ensaios/").
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
}))
