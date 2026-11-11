// 不再手动标熟悉/不熟悉：按翻卡行为自动判断；没学过的词不会被安排复习
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5300 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  const rv = await page.textContent('[data-testid=start-review]'); assert(rv.includes('学过的词到期后'), rv); ok('没学过新词时：不安排复习（初始自评的词不算）')
  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=card]')
  assert.equal(await page.locator('[data-testid=rate1]').count(), 0); ok('学习界面没有 陌生/不熟悉/熟悉/精通 按钮')
  const total0 = Number((await page.textContent('.cnt')).split('/')[1])
  // 第 1 张：直接「认识」
  await page.tap('[data-testid=next]'); await page.waitForSelector('[data-testid=judge]')
  assert((await page.textContent('[data-testid=judge]')).includes('认识')); ok('没翻卡直接下一个 → 判定「认识」')
  // 第 2 张：看一次答案
  await page.tap('[data-testid=peek]'); await page.tap('[data-testid=next]'); await page.waitForTimeout(150)
  assert((await page.textContent('[data-testid=judge]')).includes('再熟悉')); ok('翻了 1 次看答案 → 判定「再熟悉一下」')
  // 第 3 张：来回翻 2 次 → 陌生，会再出现
  await page.tap('[data-testid=peek]'); await page.tap('[data-testid=peek]'); await page.tap('[data-testid=peek]'); await page.tap('[data-testid=next]'); await page.waitForTimeout(150)
  assert((await page.textContent('[data-testid=judge]')).includes('多看几遍')); ok('来回翻 2 次以上 → 判定「多看几遍」')
  const total1 = Number((await page.textContent('.cnt')).split('/')[1]); assert.equal(total1, total0); ok('「多看几遍」的词稍后会再出现（不重复计数）')
  await page.tap('text=‹ 返回'); await page.waitForSelector('[data-testid=start-today]')
  const t = await page.textContent('[data-testid=start-today]'); assert(/3\/\d+/.test(t), t); ok('首页今日新词进度 3/N')
  const rv2 = await page.textContent('[data-testid=start-review]'); ok('学过之后复习才会出现：' + rv2.replace(/\s+/g, ' ').slice(0, 40))
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/autolevel-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
