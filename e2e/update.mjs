// 强制更新：服务器上的 version.json 和 App 内置版本不同 →「我的」页检查更新能发现；用着时回到前台会出「有新版本」条，点了带新版本号重新打开
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 6900 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 14'] })
const page = await ctx.newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const real = JSON.parse(readFileSync('dist/version.json', 'utf8')).id
let serve = real
await page.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: serve }) }))
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-me]'); await page.waitForTimeout(800)
  assert(!page.url().includes('v=')); ok('版本一致：不会自己刷新')
  await page.tap('[data-testid=tab-me]'); assert((await page.textContent('[data-testid=version]')).includes(real)); ok('「我的」页显示版本号 ' + real)
  await page.tap('[data-testid=check-update]'); await page.waitForFunction(() => document.querySelector('[data-testid=version]').textContent.includes('最新')); ok('检查更新：已经是最新版本')
  serve = '209901010000'; await page.waitForTimeout(4200)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForSelector('[data-testid=update-bar]'); ok('服务器有新版本、回到前台 → 顶部出现「有新版本 · 点这里更新」')
  await page.tap('[data-testid=update-bar]'); await page.waitForURL(/v=209901010000/); ok('点了以后带新版本号重新打开（绕开旧缓存）')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/upd-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
