import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Aceita conexões de qualquer dispositivo na rede
    proxy: {
      // Todas as requisições /api/... são redirecionadas pro backend Express
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Suporte a WebSocket se necessário
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
  }
})
