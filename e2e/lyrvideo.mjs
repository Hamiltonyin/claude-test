// 歌词背诵：新歌「อยู่ตรงนี้」12 句 + 导入视频后每句有预设时间，点一句播放真人片段
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 7900 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 55 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/lyr-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const mp3 = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) mp3.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=open-lyrics]'); await page.tap('[data-testid=open-lyrics]'); await page.waitForSelector('[data-testid=lyr-yu-trong-nee]')
  await page.tap('[data-testid=lyr-yu-trong-nee]'); await page.waitForSelector('[data-testid=lyr-line]')
  assert(await page.locator('[data-testid=lyr-line]').count() === 12); ok('新歌 12 句')
  await page.setInputFiles('[data-testid=lyr-vfile]', '/tmp/lyr-rec.mp4'); await page.waitForSelector('[data-testid=lyr-video]'); await page.waitForTimeout(500)
  assert(await page.locator('[data-testid=lyr-vclip]:disabled').count() === 0); ok('导入视频后：12 句都有预设起止秒')
  mp3.length = 0
  await page.locator('[data-testid=lyr-line] .lbody').nth(3).tap(); await page.waitForTimeout(800)
  const t = await page.evaluate(() => document.querySelector('[data-testid=lyr-video]').currentTime); assert(t >= 11.4, 't=' + t); assert(mp3.length === 0); ok('点第 4 句：播放视频 11.5s 起（' + t.toFixed(1) + 's），没放电子音')
  await page.locator('[data-testid=lyr-calbtn]').nth(3).tap(); await page.waitForSelector('[data-testid=lyr-cal]'); ok('可以校准时间')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/lv-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
