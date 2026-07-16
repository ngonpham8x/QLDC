import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
  registerType: 'autoUpdate',

  workbox: {
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
  },

  includeAssets: [
    'favicon.ico',
    'apple-touch-icon.png',
    'logo-192.png',
    'logo-512.png'
  ],
      manifest: {
        name: 'Hệ thống Quản lý Dân cư',
        short_name: 'QLDC',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0b7a43',
        icons: [
          {
            src: '/logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },

  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {}
  }
})