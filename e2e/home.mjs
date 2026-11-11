// 首页改版：进度环/今日任务/成就墙；新成就解锁弹窗；全部完成撒彩纸
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5200 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ ...devices['iPhone 14'] })
await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))   // 让应用以为是真人，弹出成就
const page = await ctx.newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=unlock]', { timeout: 8000 })
  assert((await page.textContent('[data-testid=unlock]')).includes('解锁新成就')); ok('首次打开：弹出「解锁新成就」（用初始数据算出的成就）')
  await page.tap('.ucard .btn'); await page.waitForTimeout(300)
  assert.equal(await page.locator('[data-testid=unlock]').count(), 0); ok('点「太棒了」关闭弹窗')
  await page.reload(); await page.waitForSelector('[data-testid=ring]'); await page.waitForTimeout(800)
  assert.equal(await page.locator('[data-testid=unlock]').count(), 0); ok('已庆祝过的成就刷新后不再弹')
  assert(await page.locator('[data-testid=achievements] .badge.on').count() >= 2); ok('成就墙有已点亮的徽章')
  assert((await page.textContent('[data-testid=achievements]')).includes('下一个成就')); ok('显示「下一个成就」进度')
  assert((await page.textContent('[data-testid=hero-cta]')).includes('开始学习新词')); ok('主按钮：开始学习新词')
  await page.tap('[data-testid=hero-cta]'); await page.waitForSelector('[data-testid=card]'); ok('主按钮进入学习')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/home-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
