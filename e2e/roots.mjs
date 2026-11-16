// 构词规律页 + 卡片上的「💡 为什么」推理
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6200 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/?home=full`); await page.waitForSelector('[data-testid=open-roots]')
  await page.tap('[data-testid=open-roots]'); await page.waitForSelector('[data-testid=root]')
  const n = await page.locator('[data-testid=root]').count(); assert(n >= 25); ok(`构词规律 ${n} 个部件`)
  const first = await page.locator('[data-testid=root]').first().textContent(); assert(first.includes('个词')); ok('每个部件显示规律 + 它造出的词')
  req.length = 0; await page.locator('[data-testid=root-member]').first().tap(); await page.waitForTimeout(500)
  assert(req.length >= 1); ok('点词：播放读音')
  await page.tap('.close'); await page.tap('.tabbar button:nth-child(3)'); await page.fill('input', 'ห้องน้ำ'); await page.waitForTimeout(400)
  await page.locator('[data-testid=word-row]').first().tap(); await page.waitForSelector('[data-testid=card]'); await page.tap('[data-testid=card]')
  await page.waitForSelector('[data-testid=parts-why]', { timeout: 6000 })
  assert((await page.textContent('[data-testid=parts-why]')).includes('有水的房间')); ok('卡片：💡 房间+水 →「有水的房间」')
  await page.goto(`http://localhost:${port}/?home=full`); await page.waitForSelector('.tabbar')
  await page.tap('.tabbar button:nth-child(3)'); await page.fill('input', 'ขอบคุณ'); await page.waitForTimeout(400)
  await page.locator('[data-testid=word-row]').first().tap(); await page.waitForSelector('[data-testid=card]'); await page.tap('[data-testid=card]')
  await page.waitForSelector('[data-testid=mnemonics]', { timeout: 6000 })
  const mt = await page.textContent('[data-testid=mnemonics]'); assert(mt.includes('记忆法')); ok('卡片：🧠 记忆法 —— ' + mt.replace('🧠 记忆法', '').slice(0, 40))
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/roots-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
