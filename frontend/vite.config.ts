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
        target: 'http://127.0.0.1:8123',
        ws: true,
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
      }
    }
  }
})
