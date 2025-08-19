import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // COOP 오류 방지를 위한 추가 헤더
      'Cross-Origin-Opener-Policy-Report-Only': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy-Report-Only': 'unsafe-none',
      // 팝업 관련 추가 헤더
      'Permissions-Policy': 'popup=*, fullscreen=*',
      'Feature-Policy': 'popup *; fullscreen *'
    },
    cors: true,
    // COOP 오류 방지를 위한 추가 설정
    hmr: {
      overlay: false
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  // COOP 오류 방지를 위한 추가 설정
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  }
})
