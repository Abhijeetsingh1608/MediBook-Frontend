import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/providers': 'http://localhost:8080',
      '/slots': 'http://localhost:8080',
      '/appointments': 'http://localhost:8080',
      '/payments': 'http://localhost:8080',
      '/reviews': 'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/records': 'http://localhost:8080',
    }
  }
})
