// 声调校对：5 组 → 卡片播放 → 整组连读 → 听音辨调（答题、结果）
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5800 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-tones]')
  await page.tap('[data-testid=open-tones]'); await page.waitForSelector('[data-testid=tone-set]')
  assert(await page.locator('[data-testid=tone-set]').count() === 5); ok('声调校对 5 组')
  assert(await page.locator('[data-testid=tone-set]').first().locator('[data-testid=tone-card]').count() === 5); ok('第一组 ปา：5 个声调卡片')
  const txt = await page.locator('[data-testid=tone-set]').first().textContent()
  for (const t of ['ปา', 'ป่า', 'ป้า', 'ป๊า', 'ป๋า']) assert(txt.includes(t), t); ok('ปา ป่า ป้า ป๊า ป๋า 都在')
  req.length = 0; await page.locator('[data-testid=tone-card]').nth(2).tap(); await page.waitForTimeout(500)
  assert(req.length >= 1); ok('点卡片播放：请求音频')
  await page.locator('[data-testid=tone-all]').first().tap(); await page.waitForTimeout(300); await page.locator('[data-testid=tone-all]').first().tap(); ok('整组连读可开始/停止')
  await page.locator('[data-testid=tone-quiz]').first().tap(); await page.waitForSelector('[data-testid=tq-opt]')
  assert(await page.locator('[data-testid=tq-opt]').count() === 5); ok('听音辨调：5 个声调选项')
  for (let i = 0; i < 10; i++) {
    await page.locator('[data-testid=tq-opt]').first().tap(); await page.waitForSelector('[data-testid=tq-fb]')
    await page.tap('[data-testid=tq-next]'); await page.waitForTimeout(80)
  }
  await page.waitForSelector('[data-testid=tq-result]'); ok('10 题答完出现结果：' + (await page.textContent('[data-testid=tq-result] h2')))
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/tone-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
