// 分类页：按主题浏览，不受每天课程限制
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4800 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]')
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=cat-food]')
  assert((await page.textContent('[data-testid=cat-food]')).includes('已学')); ok('分类页：已解锁分类卡片显示「已学 x/N」')
  assert(await page.locator('.catcard.locked').count() >= 1 && await page.locator('[data-testid=cat-beauty]').isDisabled()); ok('没有词的分类显示为未解锁（美容美发）')
  await page.screenshot({ path: '/tmp/cats.png' })
  await page.tap('[data-testid=cat-fruit]'); await page.waitForSelector('[data-testid=cat-all]')
  assert((await page.textContent('[data-testid=cat-all]')).includes('8')); ok('水果分类：8 个词（第7天和第15天的词合在一起，与天数无关）')
  await page.tap('[data-testid=cat-all]'); await page.waitForSelector('[data-testid=card]')
  assert((await page.textContent('.cnt')).trim() === '1 / 8'); ok('进入学习：1 / 8')
  await page.tap('text=‹ 返回').catch(() => {})
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=cat-v-core]')
  await page.tap('[data-testid=cat-v-buy]'); await page.waitForSelector('.catrow')
  const nrows = await page.locator('.catrow').count(); assert(nrows >= 1 && nrows <= 10, '动词分类词数 ' + nrows); ok(`动词分类「买卖付款」${nrows} 个词（每类不超过 10）`)
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/cats-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
