// 卡片正面显示罗马拼音；在「我的」里可以关闭
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 6400 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const openWord = async () => {
  await page.tap('.tabbar button:nth-child(3)'); await page.fill('input', 'ขอบคุณ'); await page.waitForTimeout(400)
  await page.locator('[data-testid=word-row]').first().tap(); await page.waitForSelector('[data-testid=thai]')
}
try {
  await page.goto(`http://localhost:${port}/?home=full`); await page.waitForSelector('.tabbar')
  await openWord()
  const t = await page.locator('.face.front .frontrom').first().textContent(); assert(t.includes('khɔ̀ɔp')); ok('卡片正面泰文下面有罗马拼音：' + t)
  await page.tap('.close').catch(() => {}); await page.goto(`http://localhost:${port}/?home=full`); await page.waitForSelector('.tabbar')
  await page.tap('.tabbar button:nth-child(5)'); await page.waitForSelector('[data-testid=front-roman]')
  await page.uncheck('[data-testid=front-roman]'); await page.waitForTimeout(200)
  await openWord(); assert(await page.locator('.face.front .frontrom').count() === 0); ok('「我的」里关掉后，正面不再显示')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/fr-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
