// 点「下一个」直接读一遍新词；在「我的」里可关闭
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6500 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) req.push(r.url().match(/audio\/([^/?]+)/)[1]) })
let bad = 0; const ok = (n) => console.log('✓', n)
const openStudy = async () => {
  await page.tap('.tabbar button:nth-child(3)'); await page.waitForSelector('[data-testid=word-row]')
  await page.locator('[data-testid=word-row]').first().tap(); await page.waitForSelector('[data-testid=next]')
}
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('.tabbar')
  await openStudy(); await page.waitForTimeout(400); req.length = 0
  await page.tap('[data-testid=next]'); await page.waitForTimeout(700)
  assert(req.length === 1, '请求 ' + req.join(',')); ok('点「下一个」：直接读新词一次（' + req[0] + '）')
  req.length = 0; await page.tap('[data-testid=next]'); await page.waitForTimeout(700)
  assert(req.length === 1 && req[0]); ok('再点一次：又读新的一个')
  await page.tap('.close'); await page.tap('.tabbar button:nth-child(5)'); await page.waitForSelector('[data-testid=next-read]')
  await page.uncheck('[data-testid=next-read]'); await page.waitForTimeout(200)
  await openStudy(); await page.waitForTimeout(400); req.length = 0
  await page.tap('[data-testid=next]'); await page.waitForTimeout(700)
  assert(req.length === 0, '关掉后仍请求 ' + req.join(',')); ok('「我的」里关掉后不再自动读')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/nr-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
