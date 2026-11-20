import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'pwa-icon.png'],
      manifest: {
        name: 'Chartered Mentor',
        short_name: 'Chartered Mentor',
        description: 'Chartered Mentor Student and Admin Portal',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-icon.png',
            sizes: '512x512',
            type: 'image/png'
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
