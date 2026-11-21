// 连续播放：视频一直播不停顿，滚轴选中的那句要和视频进度对得上（每句开始时滚轴已到位）
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7600 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 55 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/auto-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const STARTS = [0, 3.9, 7.7, 11.5, 17.2, 21.0, 24.8, 28.7, 34.4, 38.3, 42.1, 45.9]
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.tap('[data-testid=open-lyrics]'); await page.tap('[data-testid=lyr-yu-trong-nee]'); await page.waitForSelector('[data-testid=wheel]')
  await page.setInputFiles('[data-testid=lyr-vfile]', '/tmp/auto-rec.mp4'); await page.waitForSelector('[data-testid=lyr-video]'); await page.waitForTimeout(600)
  await page.tap('[data-testid=lyr-playall]')
  const samples = []
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(200)
    const r = await page.evaluate(() => ({ t: document.querySelector('[data-testid=lyr-video]').currentTime, c: document.querySelector('[data-testid=wheel-count]').textContent, sp: document.querySelector('[data-testid=wheel]').scrollTop }))
    samples.push({ t: r.t, sel: parseInt(r.c) - 1, sp: r.sp })
  }
  const last = samples[samples.length - 1]; assert(last.t > 12, '视频没有连续播放，t=' + last.t); ok('视频连续播放了 ' + last.t.toFixed(1) + ' 秒，没有停顿')
  let viol = 0
  for (const s of samples) {
    const exp = STARTS.filter(x => x <= s.t + 0.05).length - 1
    // 刚好在句子边界附近 ±0.35s 不算（滚动正在进行）
    const near = STARTS.some(x => Math.abs(s.t - x) < 0.35)
    if (!near && s.sel !== exp) viol++
  }
  assert(viol === 0, '滚轴和视频不同步的采样数：' + viol); ok('滚轴选中的句子和视频进度一直对得上（' + samples.length + ' 次采样 0 偏差）')
  await page.tap('[data-testid=lyr-playall]'); await page.waitForTimeout(300)
  const p = await page.evaluate(() => document.querySelector('[data-testid=lyr-video]').paused); assert(p); ok('点 ⏹ 停止')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/as-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
