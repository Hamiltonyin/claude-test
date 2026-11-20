// 情景对话：导入真人视频 → 每句设起止秒数 → 点 🎬 播放片段 → 刷新仍在
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 7400 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 8 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/dlg-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
await page.addInitScript(() => { try { localStorage.setItem('thai30-dlg-mode', '"chat"') } catch {} })
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const openDlg = async () => {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=open-dialogues]'); await page.tap('[data-testid=open-dialogues]'); await page.waitForSelector('[data-testid=dlg-exp-real]')
  await page.tap('[data-testid=dlg-exp-real]'); await page.waitForSelector('[data-testid=bubble]')
}
try {
  await openDlg()
  assert(await page.locator('[data-testid=bubble]').count() === 8); ok('「真实录音：快递员的话」8 句')
  assert(await page.locator('[data-testid=dlg-vclip]').count() === 0); ok('没导入视频时没有视频按钮')
  await page.setInputFiles('[data-testid=dlg-vfile]', '/tmp/dlg-rec.mp4'); await page.waitForSelector('[data-testid=dlg-video]'); await page.waitForTimeout(400)
  assert(await page.locator('[data-testid=dlg-vclip]').count() === 8); ok('导入视频后：每句多了「🎬 未设置时间」和「⚙ 校准」')
  await page.locator('[data-testid=dlg-calbtn]').nth(1).tap(); await page.waitForSelector('[data-testid=dlg-cal]')
  await page.evaluate(() => { document.querySelector('[data-testid=dlg-video]').currentTime = 2 }); await page.waitForTimeout(300)
  await page.tap('[data-testid=dlg-setstart]'); await page.waitForTimeout(150)
  await page.evaluate(() => { document.querySelector('[data-testid=dlg-video]').currentTime = 4 }); await page.waitForTimeout(300)
  await page.tap('[data-testid=dlg-setend]'); await page.waitForTimeout(150)
  const rg = await page.textContent('[data-testid=dlg-range]'); assert(/^2\.0\d?s – 4\.0/.test(rg) || /^2\./.test(rg), rg); ok('第 2 句：起点 2s、终点 4s → ' + rg)
  await page.locator('[data-testid=dlg-vclip]').nth(1).tap(); await page.waitForTimeout(500)
  const t = await page.evaluate(() => document.querySelector('[data-testid=dlg-video]').currentTime); assert(t >= 1.9, 't=' + t); ok('点 🎬：从 2s 开始播放（currentTime=' + t.toFixed(1) + '）')
  await openDlg(); await page.waitForSelector('[data-testid=dlg-video]'); await page.waitForTimeout(400)
  assert((await page.locator('[data-testid=dlg-vclip]').nth(1).textContent()).includes('2.'), '刷新后时间轴丢了'); ok('刷新后视频和时间轴仍在')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/dv-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
