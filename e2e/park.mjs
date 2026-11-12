// 「近期用不上」：搁置一个词（不算认识），可撤销，可在词库里找到并恢复
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5400 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=thai]')
  const t1 = await page.textContent('[data-testid=thai]')
  await page.tap('[data-testid=park]'); await page.waitForSelector('[data-testid=park-toast]'); ok('点「近期用不上」→ 提示已搁置，可撤销')
  assert.notEqual(await page.textContent('[data-testid=thai]'), t1); ok('自动进入下一个词')
  await page.tap('[data-testid=park-undo]'); await page.waitForTimeout(300)
  assert.equal(await page.textContent('[data-testid=thai]'), t1); assert.equal(await page.locator('[data-testid=park]').count(), 1); ok('撤销 → 回到这个词，恢复正常')
  await page.tap('[data-testid=park]'); await page.waitForTimeout(300)
  await page.tap('text=‹ 返回'); await page.waitForSelector('[data-testid=start-today]')
  const today = await page.textContent('[data-testid=start-today]'); assert(/0\/\d+/.test(today), today); ok('搁置不算学过：今日新词仍 0/N（空出的位置自动补了别的词）')
  await page.tap('[data-testid=tab-library]'); await page.waitForSelector('[data-testid=chip-parked]')
  assert((await page.textContent('[data-testid=chip-parked]')).includes('1')); ok('词库「⏸ 近期用不上」显示 1')
  await page.tap('[data-testid=chip-parked]'); await page.waitForTimeout(300)
  const rows = await page.locator('[data-testid=word-row]').allTextContents(); assert.equal(rows.length, 1); assert(rows[0].includes(t1)); ok('筛选出被搁置的那个词：' + t1)
  await page.tap('[data-testid=word-row]'); await page.waitForSelector('[data-testid=unpark]'); await page.tap('[data-testid=unpark]'); await page.waitForTimeout(300)
  await page.tap('text=‹ 返回'); await page.waitForTimeout(300)
  assert((await page.textContent('[data-testid=chip-parked]')).includes('0')); ok('点「恢复」后搁置数回到 0')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/park-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
