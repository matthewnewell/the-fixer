import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { conwaysDrawer } from '@conways/drawer/vite'

export default defineConfig({
  plugins: [react(), conwaysDrawer()],
  server: {
    port: 5177,
    proxy: {
      '/api': {
        target: 'http://localhost:8092',
        changeOrigin: true,
      },
    },
  },
})
