// 陌生词重现：要有明确标注，计数按「不同的词」算；可在设置里关闭
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4700 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const ok = (n) => console.log('✓', n); let bad = 0
const rate = async (n) => { await page.tap('[data-testid=card]'); await page.waitForTimeout(420); await page.tap('[data-testid=rate' + n + ']'); await page.waitForTimeout(150) }
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  await page.waitForFunction(() => document.querySelector('[data-testid=start-today]')?.textContent.includes('新词 30 个'), null, { timeout: 8000 })
  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=thai]')
  const first = await page.textContent('[data-testid=thai]')
  const seen = new Set([first])
  await rate(1)                                   // 第1个词评「陌生」
  for (let i = 0; i < 5; i++) { seen.add(await page.textContent('[data-testid=thai]')); await rate(3) }
  const t = await page.textContent('[data-testid=thai]')
  assert.equal(t, first); ok('陌生词在 6 张卡之后再次出现：' + t)
  assert(await page.isVisible('[data-testid=repeat-badge]')); ok('重现的卡有「再看一遍」标注')
  const cnt = (await page.textContent('.cnt')).trim(); assert.equal(cnt, '6 / 30'); ok('计数按不同的词算：' + cnt + '（不会变成 7/31）')
  await rate(3)                                   // 这次评熟悉，不会再重现
  assert(!(await page.isVisible('[data-testid=repeat-badge]'))); ok('下一张是新词，没有重复标注')
  // 关闭「陌生词再出现」后不再重现
  await page.tap('text=‹ 返回'); await page.tap('[data-testid=tab-me]')
  await page.locator('label:has-text("再出现一次") input').uncheck(); ok('设置里可以关闭陌生词重现')
  await page.tap('[data-testid=tab-home]'); await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=thai]')
  const a = await page.textContent('[data-testid=thai]'); await rate(1)
  for (let i = 0; i < 6; i++) { assert.notEqual(await page.textContent('[data-testid=thai]'), a); await rate(3) }
  ok('关闭后，陌生词不再重现')
} catch (e) { console.error('FAIL', e.message); bad++ }
finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
console.log(bad ? 'FAIL' : '陌生词重现测试通过 ✓'); process.exit(bad ? 1 : 0)
