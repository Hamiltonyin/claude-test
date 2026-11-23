// TikTok 收藏：学习页入口 → 内置收藏有链接和句子（点句子读音、点拼音查元音）→ 自己加一条（存本机，刷新还在）→ 删除
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7000 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const open = async () => { await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]'); await page.tap('[data-testid=open-tiktok]'); await page.waitForSelector('[data-testid=tt-item]') }
try {
  await open(); ok('学习页有「TikTok收藏」入口')
  const href = await page.getAttribute('[data-testid=tt-open]', 'href'); assert(/tiktok\.com/.test(href)); ok('内置收藏：有「打开 TikTok」链接 ' + href)
  assert(await page.locator('[data-testid=tt-line]').count() >= 2); ok('内置收藏里有抄好的句子')
  await page.locator('[data-testid=tt-line] [data-testid=tap-syl]').first().tap(); await page.waitForSelector('[data-testid=vinfo]'); ok('点拼音音节 → 显示元音')
  await page.tap('[data-testid=tt-add]'); await page.fill('[data-testid=tt-url]', 'https://vt.tiktok.com/ZSabc123/'); await page.fill('[data-testid=tt-title]', '测试收藏'); await page.fill('[data-testid=tt-text]', 'สวัสดีครับ\n你好')
  await page.tap('[data-testid=tt-save]'); await page.waitForTimeout(300)
  assert((await page.locator('[data-testid=tt-item]').first().textContent()).includes('测试收藏')); ok('自己加一条：链接 + 名字 + 句子')
  await page.waitForTimeout(300); await open(); assert((await page.locator('[data-testid=tt-item]').first().textContent()).includes('测试收藏')); ok('刷新后还在（存在本机）')
  page.once('dialog', d => d.accept()); await page.tap('[data-testid=tt-del]'); await page.waitForTimeout(300)
  assert(!(await page.locator('[data-testid=tt-item]').first().textContent()).includes('测试收藏')); ok('可以删除')
  await page.tap('[data-testid=tt-lyric]'); await page.waitForSelector('[data-testid=lyr-taw-lae]'); ok('「去歌词背诵」跳到歌词列表')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/tt-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
