// 歌曲循环播放：歌词页 ▶ 旁边有 🔁 按钮（刷新后记住）；开了循环，直接点视频播放的，播完从头再来；关掉就停在结尾
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7400 + Math.floor(Math.random() * 90)
const vfile = mkdtempSync(tmpdir() + '/lyrloop-') + '/v.mp4'
execSync(`ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 2 -pix_fmt yuv420p -c:v libx264 -c:a aac ${vfile}`)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const openSong = async () => {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.tap('[data-testid=open-lyrics]'); await page.waitForSelector('[data-testid=lyr-yu-trong-nee]'); await page.tap('[data-testid=lyr-yu-trong-nee]'); await page.waitForSelector('[data-testid=lyr-loop]')
}
const vstate = () => page.evaluate(() => { const v = document.querySelector('[data-testid=lyr-video]'); return { t: v.currentTime, ended: v.ended, paused: v.paused, plays: window.__vplays } })
try {
  await page.addInitScript(() => { window.__vplays = 0; document.addEventListener('play', e => { if (e.target.tagName === 'VIDEO') window.__vplays++ }, true) })
  await openSong()
  assert.equal(await page.getAttribute('[data-testid=lyr-loop]', 'aria-pressed'), 'false'); ok('▶ 旁边有 🔁 按钮，默认不循环')
  await page.tap('[data-testid=lyr-loop]'); assert.equal(await page.getAttribute('[data-testid=lyr-loop]', 'aria-pressed'), 'true'); ok('点一下打开循环')
  await page.waitForTimeout(300); await openSong()
  assert.equal(await page.getAttribute('[data-testid=lyr-loop]', 'aria-pressed'), 'true'); ok('刷新后还记得开着循环')
  await page.setInputFiles('[data-testid=lyr-vfile]', vfile); await page.waitForSelector('[data-testid=lyr-video]'); await page.waitForTimeout(500)
  await page.evaluate(() => { const v = document.querySelector('[data-testid=lyr-video]'); v.muted = true; v.currentTime = 1.2; return v.play() })
  await page.waitForTimeout(2200)
  let s = await vstate(); assert(!s.ended && !s.paused && s.plays >= 2, JSON.stringify(s)); ok(`直接播放视频：播完自动从头再放（第 ${s.plays} 遍，现在 ${s.t.toFixed(1)}s）`)
  await page.tap('[data-testid=lyr-loop]'); assert.equal(await page.getAttribute('[data-testid=lyr-loop]', 'aria-pressed'), 'false')
  await page.waitForTimeout(2600)
  s = await vstate(); assert(s.ended || s.paused, JSON.stringify(s)); ok('关掉循环：播到结尾就停')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/lyrloop-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
