// 歌词背诵：首页入口 → 歌曲 → 19 句 → 播放 → 遮住泰文+开头提示 → 点开 → 整首播放
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6000 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\/lyr-/.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-lyrics]')
  await page.tap('[data-testid=open-lyrics]'); await page.waitForSelector('[data-testid=lyr-ngao-jung-bei]'); ok('首页「歌词背诵」→ 歌曲列表')
  await page.tap('[data-testid=lyr-ngao-jung-bei]'); await page.waitForSelector('[data-testid=lyr-line]')
  assert(await page.locator('[data-testid=lyr-line]').count() === 19); ok('19 句歌词')
  assert((await page.locator('.lchunks').first().locator('.rom').count()) === 2); ok('拼音按「｜」分成词组显示')
  await page.locator('[data-testid=lyr-play]').first().tap(); await page.waitForTimeout(600)
  assert(req.some(u => /lyr-ngao-jung-bei-01\.mp3/.test(u))); ok('点喇叭播放第 1 句')
  await page.locator('[data-testid=lyr-hide]').check(); await page.waitForTimeout(200)
  assert(await page.locator('.th.masked').count() === 19); assert((await page.locator('.th.masked').first().textContent()).includes('mɔɔng duu')); ok('遮住泰文：只剩中文 + 开头提示「mɔɔng duu …」')
  await page.locator('[data-testid=lyr-line] .lbody').first().tap(); await page.waitForTimeout(150)
  assert(await page.locator('.th.masked').count() === 18); ok('点一句看泰文')
  await page.locator('[data-testid=lyr-hide]').uncheck()
  await page.selectOption('[data-testid=lyr-rep]', '2'); req.length = 0
  await page.tap('[data-testid=lyr-playall]'); await page.waitForTimeout(2500)
  assert(req.length >= 1); await page.tap('[data-testid=lyr-playall]'); ok('整首播放（每句 2 遍）可开始/停止')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/lyr-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
