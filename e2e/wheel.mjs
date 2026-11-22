// 情景对话 · 滚轴视图：默认滚轴、滚动换句、点上下箭头、点中间播放、列表/滚轴切换、滚轴里改文字
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7700 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 16 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/wheel-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
await page.addInitScript(() => { try { localStorage.setItem('thai30-dlg-act', 'true') } catch {} })
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const mp3 = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) mp3.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=open-dialogues]'); await page.tap('[data-testid=open-dialogues]'); await page.waitForSelector('[data-testid=dlg-oral-1]')
  await page.tap('[data-testid=dlg-oral-1]'); await page.waitForSelector('[data-testid=wheel]'); ok('默认就是滚轴视图')
  assert(await page.locator('[data-testid=wheel-item]').count() === 13); assert((await page.textContent('[data-testid=wheel-count]')).startsWith('1 / 13')); ok('13 句，当前是第 1 句')
  await page.evaluate(() => { document.querySelector('[data-testid=wheel]').scrollTop = 150 * 4 }); await page.waitForTimeout(500)
  assert((await page.textContent('[data-testid=wheel-count]')).startsWith('5 / 13'), await page.textContent('[data-testid=wheel-count]')); ok('滚动到第 5 句，计数跟着变')
  await page.tap('[data-testid=wheel-next]'); await page.waitForTimeout(900)
  assert((await page.textContent('[data-testid=wheel-count]')).startsWith('6 / 13')); ok('点 ▼ 下一句')
  await page.tap('[data-testid=wheel-prev]'); await page.waitForTimeout(900)
  assert((await page.textContent('[data-testid=wheel-count]')).startsWith('5 / 13')); ok('点 ▲ 上一句')
  // 导入视频：中间那句点一下 → 播放真人
  await page.setInputFiles('[data-testid=dlg-vfile]', '/tmp/wheel-rec.mp4'); await page.waitForSelector('[data-testid=dlg-video]'); await page.waitForTimeout(500)
  mp3.length = 0
  await page.locator('[data-testid=wheel-item].on .th').first().tap(); await page.waitForTimeout(800)
  const t = await page.evaluate(() => document.querySelector('[data-testid=dlg-video]').currentTime); assert(t >= 3.4, 't=' + t); assert(mp3.length === 0); ok('点中间那句：播放真人片段（' + t.toFixed(1) + 's），没放电子音')
  // 滚轴里改文字
  await page.tap('[data-testid=dlg-editbtn]'); await page.waitForSelector('[data-testid=dlg-edit]')
  await page.fill('[data-testid=dlg-edit-zh]', '要吗？（改）'); await page.tap('[data-testid=dlg-edit-save]'); await page.waitForTimeout(200)
  assert((await page.locator('[data-testid=wheel-item].on').textContent()).includes('要吗？（改）')); ok('滚轴里也能修改文字')
  await page.tap('[data-testid=dlg-edit]', { trial: true }).catch(() => {})
  // 切换到列表
  await page.tap('[data-testid=dlg-settings]'); await page.tap('[data-testid=dlg-mode-toggle]'); await page.waitForSelector('[data-testid=chat]'); assert(await page.locator('[data-testid=bubble]').count() === 13); ok('切到「列表」：13 个气泡')
  await page.tap('[data-testid=dlg-mode-toggle]'); await page.waitForSelector('[data-testid=wheel]'); ok('再切回滚轴')
  // 换到另一段对话：滚轴回到第 1 句，中间那句是看得见的
  await page.tap('.sthead .close'); await page.tap('[data-testid=dlg-oral-3]'); await page.waitForSelector('[data-testid=wheel]'); await page.waitForTimeout(400)
  assert((await page.textContent('[data-testid=wheel-count]')).startsWith('1 /')); const op = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid=wheel-item].on .wic')).opacity); assert(+op > 0.9, 'opacity ' + op); ok('换一段对话后回到第 1 句，中间那句清楚可见')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/wheel-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
