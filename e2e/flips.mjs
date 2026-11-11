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
const n = async () => Number(await page.locator('[data-testid=counts] b').first().textContent())
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-weak]')
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  assert.equal(await n(), 0); ok('新词翻卡计数 0')
  await page.tap('[data-testid=card]'); await page.waitForTimeout(300); assert.equal(await n(), 1); ok('翻一次 → 1')
  await page.tap('[data-testid=card]'); await page.tap('[data-testid=card]'); await page.waitForTimeout(300); assert.equal(await n(), 2); ok('翻回正面不计数，再翻一次 → 2')
  await page.reload(); await page.waitForSelector('[data-testid=start-weak]')
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  assert.equal(await n(), 2); ok('刷新后计数仍在')
  // 词库/搜索里点开词条 = 翻牌学习界面，同样计数；发音也计数
  await page.tap('text=‹ 返回'); await page.tap('[data-testid=tab-library]'); await page.fill('[data-testid=search]', 'ช่วย')
  await page.tap('[data-testid=word-row]'); await page.waitForSelector('[data-testid=card]')
  const cnt = async (i) => Number(await page.locator('[data-testid=counts] b').nth(i).textContent())
  const f0 = await cnt(0)
  await page.tap('[data-testid=card]'); await page.waitForTimeout(600); assert.equal(await cnt(0), f0 + 1); ok('搜索结果里也能翻卡，计数 +1')
  const p0 = await cnt(1)   // 翻面时会自动朗读一次（已计入）
  await page.locator('.study .face.back .spk button[aria-label="播放发音"]').tap(); await page.waitForTimeout(500)
  assert.equal(await cnt(1), p0 + 1); ok('点发音一次 → 已听 +1')
  await page.locator('.study .face.back .spk button.slow').tap(); await page.waitForTimeout(500)
  assert.equal(await cnt(1), p0 + 2, 'plays ' + await cnt(1)); ok('慢速发音也计入')
  await page.tap('[data-testid=study-detail]'); await page.waitForSelector('[data-testid=sheet-close]'); ok('翻卡界面里可进入「详情」（编辑词条）')
  await page.tap('[data-testid=sheet-close]')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/flips-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
