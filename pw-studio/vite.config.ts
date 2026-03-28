import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER_PORT = Number(process.env['PORT'] || 3210)

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  publicDir: path.resolve(__dirname, 'src/renderer/public'),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${SERVER_PORT}`,
      '/ws': {
        target: `ws://127.0.0.1:${SERVER_PORT}`,
        ws: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },
})
