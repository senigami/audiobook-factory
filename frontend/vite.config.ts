import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8123',
        ws: true,
        changeOrigin: true,
      },
      '/out': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/queue': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/settings': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/split': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/create_audiobook': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/cancel': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      '/analyze_long': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      }
    }
  }
})
