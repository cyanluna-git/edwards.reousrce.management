import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3004,
    host: '0.0.0.0',
    // Allow the specific sslip.io host
    allowedHosts: [
      'eob.10.182.252.32.sslip.io',
      'VTISAZUAPP218',
      'localhost',
      '127.0.0.1',
    ],
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
      ...(process.env.VITE_HMR_CLIENT_PORT
        ? { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) }
        : {}),
    },
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8004',
        changeOrigin: true,
      },
    },
  },
  logLevel: 'info',
})
