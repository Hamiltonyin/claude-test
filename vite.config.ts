import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 部署到子路径（如 GitHub Pages）时设置 BASE=/repo-name/
const base = process.env.BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: '泰语每日30词',
        short_name: 'Thai 30',
        description: '面向中文母语者的泰语每日30词抽认卡',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // 音频体积较大，不预缓存；首次播放后运行时缓存（CacheFirst），也可在「我的」页一键离线下载
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'thai30-audio-v1',
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
              // 只缓存真正的音频，防止 SPA 回退页(text/html)被当作音频缓存
              plugins: [{ cacheWillUpdate: async ({ response }: { response: Response }) => ((response.headers.get('content-type') || '').includes('audio') ? response : null) }],
              expiration: { maxEntries: 5000 },
            },
          },
        ],
      },
    }),
  ],
})
