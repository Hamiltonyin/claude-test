// 常用句式：学习页入口 → 30 个句式 → 例句读音 → 遮住中文
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 7200 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 6 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/pat-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\//.test(r.url())) req.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]')
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=open-patterns]')
  await page.tap('[data-testid=open-patterns]'); await page.waitForSelector('[data-testid=pattern]')
  assert(await page.locator('[data-testid=pattern]').count() === 32); ok('32 个句式（30 个快递句式 + 2 个数量句式）')
  assert(await page.locator('[data-testid=pat-ex]').count() >= 60); ok('每个句式 2–3 个例句')
  assert((await page.locator('[data-testid=polite] button').count()) >= 10); ok('客气小词 10 个')
  req.length = 0; await page.locator('[data-testid=pat-ex]').first().tap(); await page.waitForTimeout(500)
  assert(req.some(u => /pat-01-1\.mp3/.test(u))); ok('点例句：读音 pat-01-1.mp3')
  const t0 = await page.locator('[data-testid=pattern]').first().textContent(); assert(t0.includes('能请你')); 
  await page.check('[data-testid=pat-hidezh]'); await page.waitForTimeout(150)
  assert(!(await page.locator('[data-testid=pattern]').first().locator('.patex i').first().isVisible().catch(() => false))); ok('遮住中文：例句译文隐藏')
  assert(await page.locator('[data-testid=rec-has]').count() === 0); ok('默认没有真人读音，每句下面有「📎 上传真人读音」')
  await page.locator('[data-testid=rec-file]').first().setInputFiles('/tmp/pat-rec.mp4'); await page.waitForSelector('[data-testid=rec-has]')
  ok('上传一段视频后：这句显示「✓ 已有真人读音」')
  req.length = 0; await page.locator('[data-testid=pat-ex]').first().tap(); await page.waitForTimeout(900)
  const st = await page.evaluate(() => { const v = document.querySelector('[data-testid=rec-video]'); return { paused: v.paused, t: v.currentTime, shown: getComputedStyle(document.querySelector('[data-testid=rec-player]')).display } })
  assert(st.shown === 'block' && !st.paused && st.t > 0.2, JSON.stringify(st)); assert(req.length === 0); ok('点这句：播放真人视频（不再请求机器音频），currentTime=' + st.t.toFixed(1))
  await page.reload(); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]'); await page.tap('[data-testid=open-patterns]'); await page.waitForSelector('[data-testid=rec-has]')
  ok('刷新后真人读音还在（存在本机）')
  await page.locator('[data-testid=rec-has]').first().locator('xpath=..').getByText('删除').tap(); await page.waitForTimeout(300)
  assert(await page.locator('[data-testid=rec-has]').count() === 0); ok('删除后恢复为机器读音')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/pat-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
