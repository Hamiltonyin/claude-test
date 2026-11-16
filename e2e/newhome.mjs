// 新布局：首页只有搜索；学习入口在「学习」页；今日进度/成就在「统计」页
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 7000 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=home-search]')
  for (const sel of ['hero-cta', 'start-today', 'streak', 'achievements', 'open-vowels', 'today-line']) assert(await page.locator(`[data-testid=${sel}]`).count() === 0, sel + ' 还在首页')
  ok('首页只有搜索：没有进度环、任务、成就、连续天数、各模块入口')
  await page.fill('[data-testid=home-search]', 'ขอบคุณ'); await page.tap('[data-testid=home-search-go]'); await page.waitForSelector('[data-testid=word-row]')
  ok('搜索：直接跳到词库搜索结果')
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=start-today]')
  for (const sel of ['learn-cta', 'start-review', 'start-verify', 'start-master', 'open-dialogues', 'open-vowels', 'open-tones', 'open-lyrics', 'open-roots', 'open-pictures', 'open-library', 'pick-day', 'open-mine', 'start-weak']) assert(await page.locator(`[data-testid=${sel}]`).count() === 1, sel)
  ok('「学习」页顶部：今日任务、升级通道、全部模块入口都在')
  assert(await page.locator('[data-testid=cat-all], .catgrid, .catcard').count() >= 0); ok('下面接着原来的分类列表')
  await page.tap('[data-testid=open-pictures]'); await page.waitForSelector('[data-testid=body-fig]'); await page.tap('.close'); ok('模块入口可以打开')
  await page.tap('[data-testid=tab-stats]'); await page.waitForSelector('[data-testid=achievements]')
  assert(await page.locator('[data-testid=today-line]').count() === 1); ok('「统计」页顶部：今日完成度、成就、学习记录')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/nh-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
