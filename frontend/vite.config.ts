import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8123',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8123',
        ws: true,
      },
      '/out': {
        target: 'http://localhost:8123',
        changeOrigin: true,
      },
      '/queue': {
        target: 'http://localhost:8123',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:8123',
        changeOrigin: true,
      }
    }
  }
})
