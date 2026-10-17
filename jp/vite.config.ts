import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'

// 与泰语 App 同站点：泰语在 BASE，日语在 BASE + 'jp/'（BASE 如 /claude-test/）。
const root = process.env.BASE || '/'
const base = root + 'jp/'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base,
  build: { outDir: fileURLToPath(new URL('../dist/jp', import.meta.url)), emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        id: base, name: '职场日语 · 从假名开始', short_name: '职场日语', description: '从假名开始学习职场日语', lang: 'zh-CN',
        start_url: base, scope: base, display: 'standalone', orientation: 'portrait', background_color: '#ffffff', theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: base + 'index.html',
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/jp/audio/') && url.pathname.endsWith('.mp3'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'nihongo-audio-v1', rangeRequests: true, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 5000 },
            plugins: [{ cacheWillUpdate: async ({ response }: { response: Response }) => ((response.headers.get('content-type') || '').includes('audio') ? response : null) }],
          },
        }],
      },
    }),
  ],
})
