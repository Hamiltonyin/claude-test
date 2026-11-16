// 常用句式：学习页入口 → 30 个句式 → 例句读音 → 遮住中文
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 7200 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]')
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=open-patterns]')
  await page.tap('[data-testid=open-patterns]'); await page.waitForSelector('[data-testid=pattern]')
  assert(await page.locator('[data-testid=pattern]').count() === 30); ok('30 个句式')
  assert(await page.locator('[data-testid=pat-ex]').count() === 60); ok('每个句式 2 个例句，共 60 句')
  assert((await page.locator('[data-testid=polite] button').count()) >= 10); ok('客气小词 10 个')
  req.length = 0; await page.locator('[data-testid=pat-ex]').first().tap(); await page.waitForTimeout(500)
  assert(req.some(u => /pat-01-1\.mp3/.test(u))); ok('点例句：读音 pat-01-1.mp3')
  const t0 = await page.locator('[data-testid=pattern]').first().textContent(); assert(t0.includes('能请你')); 
  await page.check('[data-testid=pat-hidezh]'); await page.waitForTimeout(150)
  assert(!(await page.locator('[data-testid=pattern]').first().locator('.patex i').first().isVisible().catch(() => false))); ok('遮住中文：例句译文隐藏')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/pat-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
