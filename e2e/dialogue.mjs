// 情景对话：列表 → 聊天气泡 → 点一句播放 → 遮住泰文自测 → 连续播放
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5600 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\/dlg-/.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-dialogues]')
  await page.tap('[data-testid=open-dialogues]'); await page.waitForSelector('[data-testid=dlg-rent-h2]')
  assert((await page.textContent('[data-testid=dlg-rent-h2]')).includes('租房')); ok('首页「情景对话」→ 对话列表（租房：物业与房东）')
  await page.tap('[data-testid=dlg-rent-h2]'); await page.waitForSelector('[data-testid=bubble]')
  const n = await page.locator('[data-testid=bubble]').count(); assert(n >= 30); ok(`聊天气泡 ${n} 句，我在右边、对方在左边`)
  assert(await page.locator('.bub.me').count() > 5 && await page.locator('.bub.other').count() > 5); ok('说话人左右分开')
  await page.locator('[data-testid=bubble] [data-testid=bplay]').first().tap(); await page.waitForTimeout(700)
  assert(req.some(u => /dlg-rent-h2-01\.mp3/.test(u))); ok('点喇叭播放这一句：dlg-rent-h2-01.mp3')
  await page.locator('[data-testid=dlg-hide]').check(); await page.waitForTimeout(200)
  assert((await page.locator('.th.masked').count()) === n); ok('勾「遮住泰文」：全部只剩中文')
  await page.locator('[data-testid=bubble] .bbody').first().tap(); await page.waitForTimeout(200)
  assert((await page.locator('.th.masked').count()) === n - 1); ok('点一句 → 看到泰文对答案')
  await page.locator('[data-testid=dlg-hide]').uncheck()
  await page.locator('[data-testid=dlg-zh]').uncheck(); await page.waitForTimeout(100)
  assert((await page.locator('.dz').count()) === 0); ok('关掉中文后气泡只剩泰文和拼音')
  req.length = 0
  await page.tap('[data-testid=dlg-playall]'); await page.waitForTimeout(2200)
  assert(new Set(req.map(u => u.match(/dlg-[\w-]+\.mp3/)?.[0])).size >= 2); ok('「连续播放整段对话」：依次请求多句音频')
  await page.tap('[data-testid=dlg-playall]'); ok('可再点一下停止')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/dlg-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
