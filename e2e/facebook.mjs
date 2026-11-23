// Facebook 收藏：学习页入口 → 空列表 → 加一条（只认 Facebook 链接）→ 刷新还在 → 不会混进 TikTok 收藏 → 删除
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7100 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const home = async () => { await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]') }
try {
  await home(); await page.tap('[data-testid=open-facebook]'); await page.waitForSelector('[role=dialog][aria-label="Facebook 收藏"]'); ok('学习页有「Facebook收藏」入口')
  assert.equal(await page.locator('[data-testid=tt-item]').count(), 0); ok('一开始是空的（没有混入 TikTok 内置收藏）')
  await page.tap('[data-testid=tt-add]'); await page.fill('[data-testid=tt-url]', 'https://vt.tiktok.com/ZSabc/')
  assert(await page.isDisabled('[data-testid=tt-save]')); ok('TikTok 链接不能存进 Facebook 收藏')
  await page.fill('[data-testid=tt-url]', '看看这个 https://www.facebook.com/share/v/1AbCdEf/ 好玩'); await page.fill('[data-testid=tt-title]', 'FB测试'); await page.fill('[data-testid=tt-text]', 'ไปไหนมา')
  await page.tap('[data-testid=tt-save]'); await page.waitForTimeout(300)
  assert.equal(await page.getAttribute('[data-testid=tt-open]', 'href'), 'https://www.facebook.com/share/v/1AbCdEf/'); ok('从分享文字里取出链接，有「打开 Facebook」')
  await page.waitForTimeout(300); await home(); await page.tap('[data-testid=open-facebook]'); await page.waitForSelector('[data-testid=tt-item]')
  assert((await page.locator('[data-testid=tt-item]').first().textContent()).includes('FB测试')); ok('刷新后还在（存在本机）')
  await page.tap('.sthead .close'); await page.tap('[data-testid=open-tiktok]'); await page.waitForSelector('[data-testid=tt-item]')
  assert(!(await page.locator('[role=dialog]').textContent()).includes('FB测试')); ok('TikTok 收藏里看不到它')
  await page.tap('.sthead .close'); await page.tap('[data-testid=open-facebook]'); await page.waitForSelector('[data-testid=tt-item]')
  assert.equal(await page.textContent('[data-testid=tt-use]'), '还没用过'); ok('使用频率：一开始「还没用过」')
  await page.tap('.ttline'); await page.tap('.ttline'); await page.waitForTimeout(200)
  await page.evaluate(() => { window.open = () => null; document.querySelector('[data-testid=tt-open]').addEventListener('click', e => e.preventDefault(), { once: true }) }); await page.tap('[data-testid=tt-open]'); await page.waitForTimeout(300)
  assert.equal(await page.textContent('[data-testid=tt-use]'), '看 1 次 · 听 2 次 · 今天'); ok('打开 1 次、听 2 次被记下来')
  await home(); await page.tap('[data-testid=open-facebook]'); await page.waitForSelector('[data-testid=tt-use]')
  assert.equal(await page.textContent('[data-testid=tt-use]'), '看 1 次 · 听 2 次 · 今天'); ok('刷新后次数还在')
  page.once('dialog', d => d.accept()); await page.tap('[data-testid=tt-del]'); await page.waitForTimeout(300)
  assert.equal(await page.locator('[data-testid=tt-item]').count(), 0); ok('可以删除')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/fb-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
