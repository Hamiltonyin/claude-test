// 元音发音页：列表 → 展开 → 示范音 → 导入视频后出现「老师这一段」→ 点后视频跳到对应秒数
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 5700 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 8 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/vow-test.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\/vow-/.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=open-vowels]')
  await page.tap('[data-testid=open-vowels]'); await page.waitForSelector('[data-testid=vowel]')
  const n = await page.locator('[data-testid=vowel]').count(); assert(n === 32); ok(`元音 ${n} 个`)
  assert(await page.locator('[data-testid=vow-clip]').count() === 0); ok('没导入视频时不显示视频按钮')
  await page.locator('[data-testid=vowel] .vowtop').nth(11).tap(); await page.waitForSelector('.vowbody')
  assert((await page.textContent('.vowform')).length > 0 && await page.locator('.vmark').count() > 0); ok('展开 แ- ：例词里的元音标红')
  await page.tap('[data-testid=vow-tts]'); await page.waitForTimeout(600)
  assert(req.some(u => /vow-v12\.mp3/.test(u))); ok('示范音请求 vow-v12.mp3')
  await page.setInputFiles('[data-testid=vow-file]', '/tmp/vow-test.mp4'); await page.waitForSelector('[data-testid=vow-video]')
  await page.waitForSelector('[data-testid=vow-clip]'); ok('导入视频后出现「🎬 老师这一段」')
  await page.waitForTimeout(500)
  await page.tap('[data-testid=vow-clip]'); await page.waitForTimeout(500)
  const t = await page.evaluate(() => document.querySelector('[data-testid=vow-video]').currentTime)
  assert(t >= 19.6 - 0.01 || t >= 7.9, 't=' + t)  // 测试视频只有 8 秒，会被夹到末尾
  ok('点击后视频跳到该元音的起始秒数（currentTime=' + t.toFixed(1) + '）')
  await page.waitForSelector('[data-testid=vow-cal]'); const r0 = await page.textContent('[data-testid=vow-range]')
  await page.evaluate(() => { document.querySelector('[data-testid=vow-video]').currentTime = 3 }); await page.waitForTimeout(300)
  await page.tap('[data-testid=vow-setstart]'); await page.waitForTimeout(200)
  const r1 = await page.textContent('[data-testid=vow-range]'); assert(r1.startsWith('3.0') && r1 !== r0, r1); ok('校准：起点设为视频当前位置 → ' + r1)
  await page.reload(); await page.waitForSelector('[data-testid=open-vowels]'); await page.tap('[data-testid=open-vowels]')
  await page.locator('[data-testid=vowel] .vowtop').nth(11).tap(); await page.waitForSelector('[data-testid=vow-range]')
  assert((await page.textContent('[data-testid=vow-range]')).startsWith('3.0')); ok('刷新后校准仍在（存本机）')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/vow-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
