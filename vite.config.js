import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      external: [
        'node:crypto', 'node:path', 'node:fs', 'node:os',
        'crypto', 'path', 'fs', 'os',
      ],
    },
  },
})
