// 情景对话：真人优先（点气泡播视频片段、电子音弱化）+ 修改文字（保存/恢复/刷新仍在）+ 连续播放走真人
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 7600 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 16 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/edit-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const mp3 = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) mp3.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
const openDlg = async () => {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=open-dialogues]'); await page.tap('[data-testid=open-dialogues]'); await page.waitForSelector('[data-testid=dlg-oral-1]')
  await page.tap('[data-testid=dlg-oral-1]'); await page.waitForSelector('[data-testid=bubble]')
}
try {
  await openDlg()
  // 没有视频：电子音是主按钮
  assert(await page.locator('[data-testid=bplay] svg').count() > 0); ok('没导入视频：喇叭是主按钮')
  await page.setInputFiles('[data-testid=dlg-vfile]', '/tmp/edit-rec.mp4'); await page.waitForSelector('[data-testid=dlg-video]'); await page.waitForTimeout(500)
  assert((await page.locator('[data-testid=bplay]').first().textContent()).includes('电子音')); ok('导入视频后：电子音弱化成小按钮「🤖电子音」')
  mp3.length = 0
  await page.locator('.bbody').nth(2).tap(); await page.waitForTimeout(800)
  const t = await page.evaluate(() => document.querySelector('[data-testid=dlg-video]').currentTime); assert(t >= 2.9, 't=' + t)
  assert(mp3.length === 0, '点气泡不该放电子音：' + mp3.join(',')); ok('点气泡：播放真人片段（currentTime=' + t.toFixed(1) + '），没有放电子音')
  // 修改文字
  await page.locator('[data-testid=dlg-editbtn]').first().tap(); await page.waitForSelector('[data-testid=dlg-edit]')
  await page.fill('[data-testid=dlg-edit-roman]', 'pai nǎi àa'); await page.fill('[data-testid=dlg-edit-zh]', '去哪儿呀？'); await page.tap('[data-testid=dlg-edit-save]')
  assert((await page.locator('[data-testid=bubble]').first().textContent()).includes('pai nǎi àa')); assert(await page.locator('[data-testid=dlg-edited]').count() === 1); ok('修改拼音/中文后立刻生效，并标「已修改」')
  await page.waitForTimeout(400); await openDlg(); await page.waitForSelector('[data-testid=dlg-edited]'); assert((await page.locator('[data-testid=bubble]').first().textContent()).includes('去哪儿呀？')); ok('刷新后修改仍在')
  await page.locator('[data-testid=dlg-editbtn]').first().tap(); await page.tap('[data-testid=dlg-edit-reset]'); await page.waitForTimeout(200)
  assert(await page.locator('[data-testid=dlg-edited]').count() === 0); assert((await page.locator('[data-testid=bubble]').first().textContent()).includes('去哪呢')); ok('恢复原文')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/de-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
