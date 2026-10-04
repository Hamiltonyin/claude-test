// 端到端测试（Playwright + Chromium，iPhone 视口/触摸）。
// 用 ffmpeg 生成一个“测试音”仅放入临时目录，验证播放链路；缺失音频的词用于验证错误提示。
import { chromium, devices } from 'playwright'
import { execSync, spawn } from 'child_process'
import { cpSync, mkdirSync, rmSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import assert from 'assert'

const tmp = mkdtempSync(tmpdir() + '/t30-')
cpSync('dist', tmp + '/dist', { recursive: true })
mkdirSync(tmp + '/dist/audio', { recursive: true })
execSync(`ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=0.6" ${tmp}/dist/audio/w001.mp3`)
const port = 4400 + Math.floor(Math.random() * 500)
const srv = spawn('npx', ['vite', 'preview', '--outDir', tmp + '/dist', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const URL = `http://localhost:${port}/`
const results = []
const ok = (name) => { results.push(name); console.log('✓', name) }
const iphone = devices['iPhone 14']
const userDir = tmp + '/profile'
const launch = () => chromium.launchPersistentContext(userDir, { executablePath: '/opt/pw-browsers/chromium', ...iphone, serviceWorkers: 'allow', permissions: [] })
const errors = []
const hook = (page) => { page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) }); page.on('pageerror', e => errors.push(String(e))) }
const swipe = async (page, dx) => {
  const c = await page.context().newCDPSession(page)
  const y = 400, x0 = dx < 0 ? 330 : 100
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
  for (let i = 1; i <= 6; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 6, y }] })
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

let ctx
try {
  ctx = await launch(); let page = await ctx.newPage(); hook(page)
  // 记录 Audio.play 调用
  await page.addInitScript(() => { window.__plays = []; const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src.slice(0, 5), rate: this.playbackRate }); return o.call(this) } })
  await page.goto(URL); await page.waitForSelector('[data-testid=start-today]')
  await page.screenshot({ path: tmp + '/home.png' })
  assert((await page.textContent('body')).includes('第3天')); ok('首页：第3天、统计头')
  assert((await page.textContent('body')).includes('0/30')); ok('今日完成 0/30')

  // 今天学习：8复习 + 22新词
  assert((await page.textContent('[data-testid=start-today]')).includes('复习 8 + 新词 22')); ok('今日课程 8复习+22新词')
  await page.click('[data-testid=start-today]')
  await page.waitForSelector('[data-testid=thai]')
  const first = await page.textContent('[data-testid=thai]')
  assert(first && first.length > 0); ok('第一张卡泰文立即显示：' + first)
  await page.evaluate(() => document.fonts.ready)
  const fontOK = await page.evaluate(() => document.fonts.check('64px "Noto Sans Thai"', 'สวัสดี'))
  assert(fontOK); ok('泰文字体已加载 (Noto Sans Thai)')
  await page.screenshot({ path: tmp + '/card-front.png' })

  // 翻面 / 翻回
  await page.tap('[data-testid=card]'); await page.waitForTimeout(500)
  assert(await page.isVisible('[data-testid=roman]')); ok('点击翻面显示拼音')
  await page.screenshot({ path: tmp + '/card-back.png' })
  await page.tap('[data-testid=card]'); await page.waitForTimeout(500)
  assert(await page.evaluate(() => !document.querySelector('.card').classList.contains('flip'))); ok('再次点击翻回正面')

  // 下一词/上一词/滑动
  await page.tap('[data-testid=next]'); const second = await page.textContent('[data-testid=thai]'); assert(second !== first); ok('下一词：' + second)
  await page.tap('[data-testid=prev]'); assert((await page.textContent('[data-testid=thai]')) === first); ok('上一词')
  await swipe(page, -220); await page.waitForTimeout(200); assert((await page.textContent('[data-testid=thai]')) === second); ok('左滑 → 下一词')
  await swipe(page, 220); await page.waitForTimeout(300);  assert((await page.textContent('[data-testid=thai]')) === first); ok('右滑 → 上一词')

  // 发音：当前词顺序 = 复习词在前。找到 w001（สวัสดี）需要用库里播放；先测缺音频的错误提示
  await page.tap('.spk button[aria-label="播放发音"]'); await page.waitForSelector('.toast .note.err')
  const errTxt = await page.textContent('.toast'); assert(errTxt.includes('还没有生成')); ok('音频缺失 → 明确错误提示：' + errTxt.slice(0, 40))
  assert(errTxt.includes('重试')); ok('提示含「重试」操作')
  await page.screenshot({ path: tmp + '/audio-error.png' })
  await page.tap('text=关闭')

  // 评级并持久化
  await page.tap('[data-testid=card]'); await page.waitForTimeout(450)
  await page.tap('[data-testid=rate3]'); await page.waitForTimeout(200)
  const afterRate = await page.textContent('[data-testid=thai]'); assert(afterRate !== first); ok('评级后自动进入下一词')
  await page.tap('text=‹ 返回'); await page.waitForSelector('[data-testid=start-today]')
  assert((await page.textContent('.stats')).includes('1/30')); ok('今日完成 1/30')
  const nBefore = await page.textContent('[data-testid=start-today]')

  // 词库：搜索 + 播放真实音频 (w001)
  await page.tap('[data-testid=tab-library]'); await page.fill('[data-testid=search]', 'sa wat')
  await page.waitForTimeout(200); assert((await page.locator('[data-testid=word-row]').count()) >= 1); ok('拼音搜索（无声调符号）')
  await page.fill('[data-testid=search]', '你好'); assert((await page.locator('[data-testid=word-row]').count()) === 1); ok('中文搜索')
  await page.fill('[data-testid=search]', 'สวัสดี'); assert((await page.locator('[data-testid=word-row]').count()) === 1); ok('泰文搜索')
  await page.tap('[data-testid=word-row]')
  await page.tap('.sheet .spk button[aria-label="播放发音"]'); await page.waitForTimeout(800)
  let plays = await page.evaluate(() => window.__plays); assert(plays.length >= 1 && plays.at(-1).rate === 1); ok('点击喇叭 → 存档 MP3 实际播放')
  await page.tap('.sheet .spk button.slow'); await page.waitForTimeout(800)
  plays = await page.evaluate(() => window.__plays); assert(plays.at(-1).rate === 0.8); ok('慢速 0.8× 播放')
  await page.tap('.sheet .spk button[aria-label="播放发音"]'); await page.waitForTimeout(300)
  plays = await page.evaluate(() => window.__plays); assert(plays.length >= 3); ok('可反复播放')
  await page.screenshot({ path: tmp + '/sheet.png' })
  await page.mouse.click(200, 30)

  // 课程：第1天/第2天 + 个人成绩
  await page.fill('[data-testid=search]', '')
  await page.tap('text=按天课程'); await page.tap('[data-testid=day-1]')
  assert((await page.textContent('body')).includes('第 1 天（30 条）')); ok('第1天30条')
  await page.tap('text=‹ 所有课程'); await page.tap('[data-testid=day-2]')
  assert((await page.textContent('body')).includes('第 2 天（30 条）')); ok('第2天30条')

  // 初始熟练度计数
  await page.tap('[data-testid=tab-home]')
  const home = await page.textContent('.scroll')
  assert(/精通 12/.test(home) && /熟悉 10/.test(home) && /不熟悉 5/.test(home) && /陌生 2/.test(home) && /未标记 23/.test(home)); ok('熟练度：初始 12/9/5/3 + 刚把เผ็ด陌生→熟悉 = 精通12 熟悉10 不熟悉5 陌生2 未标记23')
} catch (e) { console.error('FAIL', e); process.exitCode = 1 }
finally {
  // 持久化：关闭整个浏览器后重开
  try {
    await ctx?.close()
    const ctx2 = await launch(); const p2 = await ctx2.newPage(); hook(p2)
    await p2.goto(URL); await p2.waitForSelector('[data-testid=start-today]')
    assert((await p2.textContent('.stats')).includes('1/30')); ok('关闭浏览器后重开：评级记录仍在 (1/30)')
    // 离线
    await p2.waitForTimeout(1500)
    await ctx2.setOffline(true); try { process.kill(-srv.pid) } catch {}; await new Promise(r => setTimeout(r, 800)); await p2.reload(); await p2.waitForSelector('[data-testid=start-today]'); ok('断网后刷新仍可打开应用 (Service Worker)')
    await p2.tap('[data-testid=tab-library]'); await p2.fill('[data-testid=search]', 'ขอบคุณ'); await p2.tap('[data-testid=word-row]')
    await p2.tap('.sheet .spk button[aria-label="播放发音"]'); await p2.waitForSelector('.toast .note.err', { timeout: 4000 })
    const t = await p2.textContent('.toast'); assert(/离线|没有生成|网络/.test(t)); ok('离线且无缓存音频 → 明确提示：' + t.slice(0, 40))
    await ctx2.close()
  } catch (e) { console.error('FAIL(persist/offline)', e); process.exitCode = 1 }
  const real = errors.filter(e => !/Failed to load resource|net::ERR|404|audio/i.test(e))
  console.log('控制台错误(排除预期的音频404/离线)：', real.length ? real : '无')
  if (real.length) process.exitCode = 1
  try { process.kill(-srv.pid) } catch {}; console.log(`截图：${tmp}/*.png`)
  console.log(`\n${results.length} 项通过`)
}
