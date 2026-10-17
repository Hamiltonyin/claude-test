// 「职场日语」端到端测试（同站点 /jp/ 子路径，与泰语 App 并存）
import { chromium, devices } from 'playwright'
import { execSync, spawn } from 'child_process'
import { cpSync, mkdirSync, rmSync, mkdtempSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import assert from 'assert'

const tmp = mkdtempSync(tmpdir() + '/jp-')
cpSync('dist', tmp + '/dist', { recursive: true })
for (const d of [tmp + '/dist/audio', tmp + '/dist/jp/audio']) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }) }
execSync(`ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=0.5" ${tmp}/dist/jp/audio/h_3042.mp3`)   // 只给「あ」一个测试音
const port = 4800 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--outDir', tmp + '/dist', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const URL = `http://localhost:${port}/`
let bad = 0; const ok = (n) => console.log('✓', n)
const errors = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ ...devices['iPhone 14'], serviceWorkers: 'allow' })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|404|audio/i.test(m.text())) errors.push(m.text()) })
await page.addInitScript(() => { window.__plays = []; const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src.split('/').pop(), rate: this.playbackRate }); return o.call(this) } })
const rate = async (n) => { await page.tap('[data-testid=card]'); await page.waitForTimeout(420); await page.tap('[data-testid=rate' + n + ']'); await page.waitForTimeout(150) }
try {
  await page.goto(URL + 'jp/'); await page.waitForSelector('[data-testid=start-today]')
  const home = await page.textContent('body')
  assert(home.includes('职场日语') && home.includes('第1天')); ok('日语 App 首页：第1天')
  assert((await page.textContent('[data-testid=start-today]')).includes('新卡片 10 张')); ok('第1天课程：平假名 あ行・か行 共 10 张新卡片')
  await page.screenshot({ path: tmp + '/home.png' })

  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=front]')
  assert.equal((await page.textContent('[data-testid=front]')).trim(), 'あ'); ok('第一张卡：あ')
  await page.tap('[data-testid=card]'); await page.waitForTimeout(500)
  assert.equal((await page.textContent('[data-testid=romaji]')).trim(), 'a'); ok('翻面：罗马音 a')
  const plays = await page.evaluate(() => window.__plays); assert(plays.length >= 1 && plays[0].src === 'h_3042.mp3'); ok('翻面自动朗读：播放 h_3042.mp3（あ）')
  assert((await page.textContent('.back')).includes('雨') && (await page.textContent('.back')).includes('あめ')); ok('背面有例词：雨 あめ，及汉字来源提示')
  assert((await page.textContent('.back')).includes('安')); ok('背面显示来源汉字「安」')
  await page.screenshot({ path: tmp + '/card-back.png' })
  await page.tap('[data-testid=rate3]'); await page.waitForTimeout(200)
  assert.equal((await page.textContent('[data-testid=front]')).trim(), 'い'); ok('评级后进入下一张：い')
  await page.tap('text=‹ 返回')

  // 五十音图
  await page.tap('[data-testid=tab-kana]'); await page.waitForSelector('[data-testid=kana-grid]')
  const n1 = await page.locator('[data-testid=kana-cell]').count(); assert.equal(n1, 46); ok('五十音图：平假名清音 46 个')
  await page.locator('[data-testid=kana-cell]').nth(5).tap(); await page.waitForSelector('[data-testid=kana-detail]')
  assert((await page.textContent('[data-testid=kana-detail]')).includes('ka')); ok('点か：显示详情 ka')
  await page.tap('text=浊音・半浊音'); assert.equal(await page.locator('[data-testid=kana-cell]').count(), 25); ok('浊音・半浊音 25 个')
  await page.tap('text=拗音'); assert.equal(await page.locator('[data-testid=kana-cell]').count(), 33); ok('拗音 33 个')
  await page.tap('[data-testid=kind-kata]'); await page.tap('text=清音'); assert.equal(await page.locator('[data-testid=kana-cell]').count(), 46); ok('片假名清音 46 个')
  await page.screenshot({ path: tmp + '/kana.png' })

  // 卡片库搜索
  await page.tap('[data-testid=tab-library]')
  await page.fill('[data-testid=search]', 'kaigi'); await page.waitForTimeout(200); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('罗马音搜索 kaigi → 会議')
  await page.fill('[data-testid=search]', '会议'); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('中文搜索 会议')
  await page.fill('[data-testid=search]', 'かいぎ'); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('假名搜索 かいぎ')
  await page.fill('[data-testid=search]', 'カイギ'); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('片假名也能搜到平假名词（カイギ）')
  await page.fill('[data-testid=search]', ''); await page.tap('text=按天课程'); assert.equal(await page.locator('[data-testid^=day-]').count(), 28); ok('课程共 28 天')

  // 刷新后进度保留
  await page.reload(); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('.stats')).includes('1/10')); ok('刷新后：今日新卡 1/10 仍在')

  // 与泰语 App 并存：两个 Service Worker 作用域互不干扰
  await page.waitForTimeout(1500)
  await page.goto(URL); await page.waitForSelector('[data-testid=start-today]'); await page.waitForTimeout(1500)
  assert((await page.textContent('body')).includes('泰语每日30词')); ok('同站点根路径仍是泰语 App')
  const scopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort())
  assert(scopes.includes('/') && scopes.includes('/jp/')); ok('两个 Service Worker 作用域独立：' + scopes.join(' , '))
  await page.goto(URL + 'jp/'); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('body')).includes('职场日语')); ok('再回 /jp/ 仍是日语 App（未被泰语 SW 劫持）')
} catch (e) { console.error('FAIL', e.message); bad++ }
try {
  // 漏学：开始日改到 3 天前
  const p2 = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
  await p2.goto(URL + 'jp/'); await p2.waitForSelector('[data-testid=start-today]')
  await p2.evaluate(() => new Promise((res, rej) => {
    const p = n => String(n).padStart(2, '0'); const d = new Date(); d.setDate(d.getDate() - 3)
    const start = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const rq = indexedDB.open('nihongo'); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(['meta', 'sessions'], 'readwrite')
      const g = tx.objectStore('meta').get('settings'); g.onsuccess = () => { tx.objectStore('meta').put({ ...g.result, startDate: start }, 'settings'); tx.objectStore('sessions').clear() }
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) }; rq.onerror = () => rej(rq.error)
  }))
  await p2.reload(); await p2.waitForSelector('[data-testid=start-today]')
  await p2.waitForTimeout(500)
  assert((await p2.textContent('body')).includes('第4天')); ok('3 天没打开：今天是第4天（按日历）')
  assert.equal(await p2.locator('[data-testid=rec-missed]').count(), 3); ok('学习记录里有 3 天漏学')
  assert((await p2.textContent('[data-testid=start-catchup]')).includes('漏学 3 天')); ok('出现「漏学补学」入口')
} catch (e) { console.error('FAIL(missed)', e.message); bad++ }
try {
  // 断网：杀掉服务器后日语 App 仍能打开
  try { process.kill(-srv.pid) } catch {}
  await new Promise(r => setTimeout(r, 800))
  await page.reload(); await page.waitForSelector('[data-testid=start-today]'); ok('断网后刷新，日语 App 仍可打开（Service Worker）')
} catch (e) { console.error('FAIL(offline)', e.message); bad++ }
await b.close(); try { process.kill(-srv.pid) } catch {}
if (errors.length) { console.error('控制台/页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '\n日语 App 全部测试通过 ✓', ` 截图：${tmp}/*.png`); process.exit(bad ? 1 : 0)
