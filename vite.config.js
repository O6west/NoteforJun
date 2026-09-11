import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src',
  publicDir: false,
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        note: resolve(import.meta.dirname, 'src/note.html'),
        list: resolve(import.meta.dirname, 'src/list.html'),
      },
    },
  },
})
