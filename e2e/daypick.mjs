// 选择天数：任选第几天 → 学习全部 / 只学没学过 / 只复习学过；调高复习上限
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4500 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=pick-day]')
  await page.waitForFunction(() => document.querySelector('[data-testid=start-today]')?.textContent.includes('新词 30 个'), null, { timeout: 8000 })
  await page.tap('[data-testid=pick-day]'); await page.waitForSelector('[data-testid=pick-1]')
  const n = await page.locator('[data-testid^=pick-]').count(); assert(n >= 17); ok(`天数列表：共 ${n} 天（含第1~17天）`)
  // 第1天：词都已有熟练度（未标记仅ร้อน）
  await page.tap('[data-testid=pick-1]'); await page.waitForSelector('[data-testid=day-all]')
  assert((await page.textContent('[data-testid=day-all]')).includes('30')); ok('第1天：学习这天全部 30 个词')
  await page.tap('[data-testid=day-review]'); await page.waitForSelector('[data-testid=card]')
  assert.equal((await page.textContent('.cnt')).trim(), '1 / 29'); ok('第1天「只复习学过的」= 29 个（ร้อน 未评过级不在内），进入学习界面')
  await page.tap('text=‹ 返回')
  // 第9天：全是新词
  await page.tap('[data-testid=pick-day]'); await page.tap('[data-testid=pick-9]'); await page.waitForSelector('[data-testid=day-fresh]')
  assert(await page.locator('[data-testid=day-review]').isDisabled()); ok('第9天还没学过：「只复习学过的」置灰')
  await page.tap('[data-testid=day-all]'); await page.waitForSelector('[data-testid=card]')
  assert.equal((await page.textContent('.cnt')).trim(), '1 / 30'); ok('第9天：学习全部 30 个词')
  await page.tap('text=‹ 返回')
  // 复习上限 15 → 30
  const before = await page.textContent('[data-testid=start-review]')
  await page.tap('[data-testid=tab-me]'); await page.selectOption('[data-testid=review-cap]', '300'); await page.waitForTimeout(400)
  await page.tap('[data-testid=tab-home]')
  const after = await page.textContent('[data-testid=start-review]'); ok(`复习上限调高：${before.replace(/\s+/g,'')} → ${after.replace(/\s+/g,'')}`)
  assert((await page.textContent('[data-testid=start-today]')).includes('新词 30 个')); ok('调高复习上限后，今天的新词数量不变')
} catch (e) { console.error('FAIL', e.message); bad++ }
finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
if (errors.length) { console.error('页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '选择天数测试通过 ✓'); process.exit(bad ? 1 : 0)
