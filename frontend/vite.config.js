import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'pwa-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Chartered Mentor',
        short_name: 'Chartered Mentor',
        description: 'Chartered Mentor Student and Admin Portal',
        start_url: '/',
        scope: '/',
        id: '/',
        theme_color: '#0284c7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/admin': {
        target: 'https://chartered-mentor-nifm.vercel.app',
        changeOrigin: true,
        secure: false,
      },
      '/student': {
        target: 'https://chartered-mentor-nifm.vercel.app',
        changeOrigin: true,
        secure: false,
      },
      '/qr': {
        target: 'https://chartered-mentor-nifm.vercel.app',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
  }
})
