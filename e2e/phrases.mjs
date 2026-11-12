// 例句可发音 + 常用词组（学习卡背面、词库详情）
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4700 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const requested = []; page.on('request', r => { if (/audio\//.test(r.url())) requested.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-weak]')
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  await page.tap('[data-testid=card]')
  await page.waitForSelector('[data-testid=phrases] .phrow', { timeout: 8000 })
  const n = await page.locator('[data-testid=phrases] .phrow').count(); assert(n >= 1); ok(`卡片背面显示常用词组 ${n} 条`)
  assert(await page.locator('[data-testid=example] .clip button').count() >= 1); ok('例句旁有发音按钮')
  const c0 = Number(await page.textContent('[data-testid=ex-count] b'))
  await page.locator('[data-testid=example] .clip button').first().tap(); await page.waitForTimeout(600)
  assert.equal(Number(await page.textContent('[data-testid=ex-count] b')), c0 + 1); ok('点例句喇叭：播放并计数（例句音频走 <词ID>_ex.mp3）')
  requested.length = 0
  await page.locator('[data-testid=phrases] .clip button').first().tap(); await page.waitForTimeout(600)
  assert(requested.some(u => /_p0\.mp3/.test(u))); ok('点词组喇叭：请求 <词ID>_p0.mp3')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/phr-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
