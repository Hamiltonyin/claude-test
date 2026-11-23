// 「生活英语」端到端测试（同站点 /en/ 子路径，与泰语、日语 App 并存）
import { chromium, devices } from 'playwright'
import { execSync, spawn } from 'child_process'
import { cpSync, mkdirSync, rmSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import assert from 'assert'

const lib = JSON.parse(readFileSync('en/public/content/library.json', 'utf8'))
const hello = lib.words.find(w => w.en === 'hello'), day1 = lib.lessons[0].wordIds.length
const tmp = mkdtempSync(tmpdir() + '/en-')
cpSync('dist', tmp + '/dist', { recursive: true })
for (const d of [tmp + '/dist/audio', tmp + '/dist/en/audio']) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }) }
execSync(`ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=0.5" ${tmp}/dist/en/audio/${hello.id}.mp3`)   // 只给 hello 一个测试音
const port = Number(process.env.E2E_PORT) || 4900 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--outDir', tmp + '/dist', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const URL = `http://localhost:${port}/`
let bad = 0; const ok = (n) => console.log('✓', n)
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 14'], serviceWorkers: 'allow' })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|404|audio/i.test(m.text())) errors.push(m.text()) })
await page.addInitScript(() => { window.__plays = []; const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src.split('/').pop() }); return o.call(this) } })
try {
  await page.goto(URL + 'en/'); await page.waitForSelector('[data-testid=start-today]')
  const home = await page.textContent('body')
  assert(home.includes('生活英语') && home.includes('第1天')); ok('英语 App 首页：第1天')
  assert((await page.textContent('[data-testid=start-today]')).includes(`新卡片 ${day1} 张`)); ok(`第1天课程：问候与礼貌 ${day1} 张`)
  assert(!(await page.locator('[data-testid=tab-kana]').count())); ok('没有日语的五十音页')
  await page.screenshot({ path: tmp + '/home.png' })

  await page.tap('[data-testid=start-today]'); await page.waitForSelector('[data-testid=front]')
  assert.equal((await page.textContent('[data-testid=front]')).trim(), 'hello'); ok('第一张卡：hello')
  await page.tap('[data-testid=card]'); await page.waitForTimeout(500)
  assert.equal((await page.textContent('[data-testid=ipa]')).trim(), '/həˈloʊ/'); ok('翻面：音标 /həˈloʊ/')
  assert((await page.textContent('.back')).includes('你好') && (await page.textContent('.back')).includes('nice to meet you')); ok('背面：中文 + 例句')
  const plays = await page.evaluate(() => window.__plays); assert(plays.some(p => p.src === hello.id + '.mp3')); ok('自动朗读：播放 ' + hello.id + '.mp3')
  await page.screenshot({ path: tmp + '/card-back.png' })
  await page.tap('[data-testid=rate3]'); await page.waitForTimeout(200)
  assert.equal((await page.textContent('[data-testid=front]')).trim(), 'hi'); ok('评级后进入下一张：hi')
  await page.tap('text=‹ 返回')

  await page.tap('[data-testid=tab-library]')
  await page.fill('[data-testid=search]', 'Landlord'); await page.waitForTimeout(200); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('英文搜索（不分大小写）Landlord')
  await page.fill('[data-testid=search]', '房东'); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('中文搜索 房东')
  await page.fill('[data-testid=search]', ''); await page.tap('text=按天课程'); assert.equal(await page.locator('[data-testid^=day-]').count(), lib.lessons.length); ok(`课程共 ${lib.lessons.length} 天`)

  await page.reload(); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('.stats')).includes(`1/${day1}`)); ok(`刷新后：今日新卡 1/${day1} 仍在`)

  await page.waitForTimeout(1500)
  await page.goto(URL + '?home=full'); await page.waitForSelector('[data-testid=start-today]'); await page.waitForTimeout(1500)
  assert((await page.textContent('body')).includes('泰语每日30词')); ok('同站点根路径仍是泰语 App')
  const scopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort())
  assert(scopes.includes('/') && scopes.includes('/en/')); ok('Service Worker 作用域独立：' + scopes.join(' , '))
  await page.goto(URL + 'en/'); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('body')).includes('生活英语')); ok('再回 /en/ 仍是英语 App（未被泰语 SW 接管）')
  assert((await page.textContent('.stats')).includes(`1/${day1}`)); ok('英语学习进度没被泰语 App 清掉')
} catch (e) { console.error('FAIL', e.message); bad++ }
try {
  try { process.kill(-srv.pid) } catch {}
  await new Promise(r => setTimeout(r, 800))
  await page.reload(); await page.waitForSelector('[data-testid=start-today]'); ok('断网后刷新，英语 App 仍可打开')
} catch (e) { console.error('FAIL(offline)', e.message); bad++ }
await b.close(); try { process.kill(-srv.pid) } catch {}
if (errors.length) { console.error('控制台/页面错误', errors); bad++ }
console.log(bad ? 'FAIL' : '\n英语 App 全部测试通过 ✓', ` 截图：${tmp}/*.png`); process.exit(bad ? 1 : 0)
