// 「我录入的词」入口：首页 → 词库已筛选 → 可学习
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4300 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load|404|audio/i.test(m.text())) errors.push(m.text()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-mine]')
  await page.waitForFunction(() => /共 \d+ 个/.test(document.querySelector('[data-testid=open-mine]')?.textContent || ''), null, { timeout: 8000 })
  const t = await page.textContent('[data-testid=open-mine]'); const n = Number(t.match(/共 (\d+) 个/)[1]); assert(n >= 40); ok(`首页「我录入的词」入口：共 ${n} 个`)
  await page.tap('[data-testid=open-mine]'); await page.waitForSelector('[data-testid=chip-mine].on')
  const rows = await page.locator('[data-testid=word-row]').count(); assert(rows > 0 && rows <= n); ok(`进入词库，已自动筛选「我录入的词」（${rows} 行）`)
  await page.fill('[data-testid=search]', 'เจอกัน'); await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-testid=word-row]').count(), 2); ok('搜索 เจอกัน → 找到 เจอกัน 和 แล้วเจอกัน')
  await page.fill('[data-testid=search]', 'ตลาด'); await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-testid=word-row]').count(), 0); ok('内置词（ตลาด 市场）不在「我录入的词」里')
  await page.fill('[data-testid=search]', ''); await page.tap('[data-testid=study-mine]'); await page.waitForSelector('[data-testid=card]')
  assert((await page.textContent('.cnt')).trim().endsWith('/ ' + n)); ok('「学习这些词」进入学习界面，卡片数与入口一致')
  await page.tap('text=‹ 返回'); await page.tap('[data-testid=chip-mine]'); await page.waitForTimeout(200)
  assert((await page.locator('[data-testid=word-row]').count()) > n); ok('再点一次筛选可取消，显示全部词库')
} catch (e) { console.error('FAIL', e.message); bad++ }
finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
if (errors.length) { console.error('页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '我录入的词测试通过 ✓'); process.exit(bad ? 1 : 0)
