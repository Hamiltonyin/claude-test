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

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<App />)
