// 图解记忆：人体图 / 一天 / 星期，点标签读音，遮住中文
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6700 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-pictures]')
  await page.tap('[data-testid=open-pictures]'); await page.waitForSelector('[data-testid=body-fig]')
  const nb = await page.locator('[data-testid=body-fig] [data-testid=pic-tag]').count(); assert(nb >= 19); ok(`人体图：${nb} 个部位标签`)
  const nf = await page.locator('[data-testid=face-fig] [data-testid=pic-tag]').count(); assert(nf >= 12); ok(`脸部放大图：${nf} 个标签`)
  req.length = 0; await page.locator('[data-testid=body-fig] [data-testid=pic-tag]').first().tap(); await page.waitForTimeout(500)
  assert(req.length >= 1); ok('点部位标签：读音')
  await page.check('.pichide input'); await page.waitForTimeout(150)
  const txt = await page.locator('[data-testid=body-fig]').textContent(); assert(!txt.includes('肩膀')); ok('遮住中文：标签里没有中文')
  await page.uncheck('.pichide input')
  await page.tap('[data-testid=pictab-time]'); await page.waitForSelector('[data-testid=scene]')
  assert(await page.locator('[data-testid=scene]').count() === 9 && await page.locator('[data-testid=scene] svg').count() === 9); ok('一天：9 个时段，每个都有图')
  const tt = await page.locator('[data-testid=scene]').allTextContents(); assert(tt.some(t => t.includes('เช้า')) && tt.some(t => t.includes('ดึก')) && tt.some(t => t.includes('เที่ยง'))); ok('เช้า / เที่ยง / ดึก 都在')
  await page.tap('[data-testid=pictab-week]'); await page.waitForSelector('[data-testid=day-card]')
  assert(await page.locator('[data-testid=day-card]').count() === 7); ok('星期：7 张卡（星球 + 颜色）')
  assert((await page.locator('[data-testid=day-card]').first().textContent()).includes('วันอาทิตย์')); ok('从星期日 วันอาทิตย์ 开始（泰国习惯）')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/pic-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
