// 词语拆解：搜到 ห้องน้ำ → 打开 → 看到「拆开记」房间+水，点部件播放；整词（นาที）显示「整词」说明
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6100 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
const open = async (q) => {
  await page.tap('.tabbar button:nth-child(3)'); await page.waitForSelector('input[type=search], input')
  await page.fill('input', q); await page.waitForTimeout(400)
  await page.locator('[data-testid=word-row]').first().tap(); await page.waitForSelector('[data-testid=card]'); await page.tap('[data-testid=card]')
}
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('.tabbar')
  await open('ห้องน้ำ'); await page.waitForSelector('[data-testid=parts]', { timeout: 6000 })
  const t = await page.textContent('[data-testid=parts]'); assert(t.includes('ห้อง') && t.includes('房间') && t.includes('น้ำ') && t.includes('水')); ok('ห้องน้ำ → 拆开记：ห้อง 房间 + น้ำ 水')
  assert(await page.locator('[data-testid=part-chip] .relrom').count() === 2); ok('每个部分带小号拼音')
  req.length = 0; await page.locator('[data-testid=part-chip]').first().tap(); await page.waitForTimeout(500)
  assert(req.length >= 1); assert(await page.locator('[data-testid=parts]').count() === 1); ok('点部分：播放读音，卡片不翻')
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('.tabbar')
  await open('นาที'); await page.waitForSelector('[data-testid=parts-whole]', { timeout: 6000 })
  assert((await page.textContent('[data-testid=parts-whole]')).includes('整个记')); ok('นาที → 「整词」：整个记，音节单独没有意思')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/parts-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
