import { chromium } from 'playwright'
const svg = (r) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#2346c8"/></linearGradient></defs>
<rect width="512" height="512" rx="${r}" fill="url(#g)"/>
<text x="256" y="335" font-size="250" text-anchor="middle" fill="#fff" font-family="Helvetica, Arial, sans-serif" font-weight="700">Aa</text>
<text x="256" y="440" font-size="80" text-anchor="middle" fill="#fff" fill-opacity=".92" font-family="Helvetica, Arial, sans-serif" font-weight="700">ABC</text></svg>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 512, height: 512 } })
const shot = async (name, size, radius) => {
  await p.setViewportSize({ width: size, height: size })
  await p.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg(radius)}`)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `en/public/icons/${name}.png`, omitBackground: true })
}
await shot('icon-512', 512, 112); await shot('icon-192', 192, 42); await shot('icon-512-maskable', 512, 0); await shot('apple-touch-icon', 180, 0)
await b.close()
