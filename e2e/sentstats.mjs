// 句子与单词分开统计：词库默认不含句子；「💬 句子」筛选；统计页有句子面板；句子评级只进句子统计
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 7800 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-library]'); await page.tap('[data-testid=tab-library]')
  await page.waitForSelector('[data-testid=chip-sent]')
  const total = Number(await page.textContent('[data-testid=chip-sent] small')); assert(total >= 77, 'sentences ' + total); ok('词库有「句子」筛选，共 ' + total + ' 句')
  await page.fill('[data-testid=search]', 'ขอบคุณ'); await page.waitForTimeout(300)
  await page.fill('[data-testid=search]', ''); await page.waitForTimeout(200)
  const wordsOnly = await page.locator('[data-testid=word-row]').count()
  await page.tap('[data-testid=chip-sent]'); await page.waitForTimeout(300)
  const sentRows = await page.locator('[data-testid=word-row]').count(); assert(sentRows === total, sentRows + ' vs ' + total); ok('句子筛选显示全部句子：' + sentRows)
  assert(wordsOnly !== sentRows); ok('默认列表不含句子')
  await page.tap('[data-testid=tab-stats]'); await page.waitForSelector('[data-testid=sent-panel]')
  assert(Number(await page.textContent('[data-testid=sent-total]')) === total); ok('统计页有句子统计面板，总数一致')
  assert(Number(await page.textContent('[data-testid=sent-today]')) === 0); ok('今日句子评级为 0')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/ss-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
