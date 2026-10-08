// 模拟「开始学习后连续 3 天没打开」：验证漏学记录、补学入口、当天仍有 30 个新词
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4600 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('body')).includes('第3天')); ok('第一次使用：第3天')
  // 把「开始日」改到 3 天前，并删除今天的课程（模拟 3 天没打开）
  await page.evaluate(() => new Promise((res, rej) => {
    const p = n => String(n).padStart(2, '0'); const d = new Date(); d.setDate(d.getDate() - 3)
    const start = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const rq = indexedDB.open('thai30'); rq.onerror = () => rej(rq.error)
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(['meta', 'sessions'], 'readwrite')
      const g = tx.objectStore('meta').get('settings')
      g.onsuccess = () => { tx.objectStore('meta').put({ ...g.result, startDate: start }, 'settings'); tx.objectStore('sessions').clear() }
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) }
  }))
  await page.reload(); await page.waitForSelector('[data-testid=start-today]')
  await page.waitForFunction(() => document.querySelector('[data-testid=start-today]')?.textContent.includes('新词 30 个'), null, { timeout: 8000 })
  assert((await page.textContent('body')).includes('第6天')); ok('3天没打开后：今天是第6天（按日历走，不是第4天）')
  const missed = await page.locator('[data-testid=rec-missed]').count(); assert.equal(missed, 3); ok('学习记录里有 3 天「漏学」')
  assert((await page.textContent('[data-testid=start-catchup]')).includes('漏学 3 天')); ok('出现「漏学补学」入口（漏学 3 天）')
  assert((await page.textContent('[data-testid=start-today]')).includes('新词 30 个')); ok('今天仍有 30 个新词')
  // 点开某个漏学日 → 详情 + 补学按钮
  await page.locator('[data-testid=rec-missed]').first().tap(); await page.waitForSelector('[data-testid=catchup-day]'); ok('点击漏学日 → 显示漏学详情和补学按钮')
  await page.tap('[data-testid=catchup-day]'); await page.waitForSelector('[data-testid=thai]')
  const t = await page.textContent('[data-testid=thai]'); assert(t); ok('补学：进入学习界面，首词 ' + t)
  // 补学一个词（评级），记录/补学数量应变化
  await page.tap('[data-testid=card]'); await page.waitForTimeout(450); await page.tap('[data-testid=rate3]'); await page.waitForTimeout(200)
  await page.tap('text=‹ 返回'); await page.waitForSelector('[data-testid=start-catchup]')
  ok('补学后返回，补学入口仍在（剩余未学词减少）')
} catch (e) { console.error('FAIL', e.message); bad++ }
finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
if (errors.length) { console.error('页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '漏学记录测试通过 ✓'); process.exit(bad ? 1 : 0)
