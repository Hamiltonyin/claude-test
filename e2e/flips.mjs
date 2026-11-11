// 翻卡计数：每个词每翻一次 +1，刷新后仍在
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4900 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const n = async () => Number((await page.textContent('[data-testid=flips-front]')).match(/\d+/)[0])
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-weak]')
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  assert.equal(await n(), 0); ok('新词翻卡计数 0')
  await page.tap('[data-testid=card]'); await page.waitForTimeout(300); assert.equal(await n(), 1); ok('翻一次 → 1')
  await page.tap('[data-testid=card]'); await page.tap('[data-testid=card]'); await page.waitForTimeout(300); assert.equal(await n(), 2); ok('翻回正面不计数，再翻一次 → 2')
  await page.reload(); await page.waitForSelector('[data-testid=start-weak]')
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  assert.equal(await n(), 2); ok('刷新后计数仍在')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/flips-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
