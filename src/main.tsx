import { createRoot } from 'react-dom/client'
import '@fontsource/sarabun/thai-400.css'
import '@fontsource/sarabun/thai-600.css'
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans/latin-ext-400.css'
import '@fontsource/noto-sans/latin-600.css'
import '@fontsource/noto-sans/latin-ext-600.css'
import './styles.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'
import { watchUpdates } from './lib/update'

// 新版本检查：iPhone 上「添加到主屏幕」的 App 很少自己检查更新，所以每次回到前台、以及每 30 分钟主动查一次；
// 查到新版本后（autoUpdate）会自动刷新页面，学习进度都在 IndexedDB 里，不会丢
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (navigator.onLine) reg.update().catch(() => { /* 离线或服务器暂时不通 */ }) }
    setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})
watchUpdates()
createRoot(document.getElementById('root')!).render(<App />)
