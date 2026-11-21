// 情景对话：小图标（播放/慢速/修改/校准、▲▼）默认藏起来，点 ⋯ 才出现；点中间那句仍可直接播放
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7800 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const mp3 = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) mp3.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.tap('[data-testid=open-dialogues]'); await page.tap('[data-testid=dlg-oral-1]'); await page.waitForSelector('[data-testid=wheel]')
  assert(await page.locator('[data-testid=bplay]').count() === 0 && await page.locator('[data-testid=dlg-editbtn]').count() === 0 && await page.locator('[data-testid=wheel-prev]').count() === 0); ok('默认：播放/慢速/修改/校准/▲▼ 都藏起来了')
  await page.locator('[data-testid=wheel-item].on').tap(); await page.waitForTimeout(1200)
  assert(mp3.length >= 1); ok('不展开图标，点中间那句照样能播放')
  await page.tap('[data-testid=dlg-act]'); await page.waitForSelector('[data-testid=bplay]')
  assert(await page.locator('[data-testid=dlg-editbtn]').count() === 1 && await page.locator('[data-testid=wheel-prev]').count() === 1); ok('点 ⋯：图标调出来')
  await page.tap('[data-testid=dlg-act]'); await page.waitForTimeout(200); assert(await page.locator('[data-testid=bplay]').count() === 0); ok('再点 ⋯：又藏起来')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/act-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
