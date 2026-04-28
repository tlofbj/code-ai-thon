import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** Forward API calls to Express so fetch('/api/...') works in dev and preview. */
const apiProxy = {
  '/api': {
    target: 'http://localhost:5001',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  }
})
