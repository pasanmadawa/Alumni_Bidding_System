import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/pet': 'http://localhost:3000',
    },
  },
})
