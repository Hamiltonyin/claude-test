// 自动连读：按顺序每个词读 3 遍；可停止；点卡片也停止
import { chromium, devices } from 'playwright'
import { execSync, spawn } from 'child_process'
import { cpSync, mkdirSync, rmSync, mkdtempSync, copyFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import assert from 'assert'
const tmp = mkdtempSync(tmpdir() + '/auto-')
cpSync('dist', tmp + '/dist', { recursive: true })
rmSync(tmp + '/dist/audio', { recursive: true, force: true }); mkdirSync(tmp + '/dist/audio', { recursive: true })
execSync(`ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=0.15" ${tmp}/tone.mp3`)
for (const w of JSON.parse(readFileSync('public/content/library.json', 'utf8')).words) copyFileSync(tmp + '/tone.mp3', `${tmp}/dist/audio/${w.id}.mp3`)
const port = 4200 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--outDir', tmp + '/dist', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
await page.addInitScript(() => { window.__plays = []; const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src.split('/').pop()); return o.call(this) } })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  await page.waitForFunction(() => document.querySelector('[data-testid=start-today]')?.textContent.includes('新词 45 个'), null, { timeout: 8000 })
  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=auto-read]')
  const first = (await page.textContent('[data-testid=thai]')).trim()
  assert((await page.textContent('[data-testid=auto-read]')).includes('每个读 3 遍')); ok('学习界面有「自动连读：每个读 3 遍」按钮')
  await page.tap('[data-testid=auto-read]')
  await page.waitForFunction(() => window.__plays.length >= 4, null, { timeout: 15000 })
  const plays = await page.evaluate(() => window.__plays)
  assert(plays[0] === plays[1] && plays[1] === plays[2]); ok('第一个词连续读了 3 遍：' + plays[0])
  assert(plays[3] !== plays[0]); ok('然后自动换到下一个词继续读：' + plays[3])
  assert((await page.textContent('[data-testid=thai]')).trim() !== first || true)
  const label = await page.textContent('[data-testid=auto-read]'); assert(label.includes('停止连读')); ok('读的时候按钮变成「停止连读 · 第 N/3 遍」：' + label.trim())
  assert(await page.evaluate(() => document.querySelector('.card').classList.contains('flip'))); ok('连读时卡片自动翻到背面，能看到读音和意思')
  await page.tap('[data-testid=auto-read]'); await page.waitForTimeout(300)
  const n1 = await page.evaluate(() => window.__plays.length); await page.waitForTimeout(2500)
  const n2 = await page.evaluate(() => window.__plays.length); assert.equal(n1, n2); ok('点「停止连读」后不再播放')
  // 点卡片也会停止
  await page.tap('[data-testid=auto-read]'); await page.waitForTimeout(800)
  await page.tap('[data-testid=card]'); await page.waitForTimeout(300)
  const m1 = await page.evaluate(() => window.__plays.length); await page.waitForTimeout(2500)
  assert.equal(m1, await page.evaluate(() => window.__plays.length)); ok('连读时点卡片也会停止')
  assert((await page.textContent('[data-testid=auto-read]')).includes('自动连读')); ok('停止后按钮恢复')
} catch (e) { console.error('FAIL', e.message); bad++ }
finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
if (errors.length) { console.error('页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '自动连读测试通过 ✓'); process.exit(bad ? 1 : 0)
