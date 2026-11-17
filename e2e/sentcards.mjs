// 句式卡片：学习页分类「句式卡片」→ 学习全部 → 正面中文 → 翻面泰语 → 下一个不提前读泰语
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 7700 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const req = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) req.push(r.url().match(/audio\/([^/?]+)/)[1]) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=cat-sent1]'); ok('「学习」页分类里有「句式卡片」组')
  await page.tap('[data-testid=cat-sent1]'); await page.waitForSelector('[data-testid=cat-all]')
  const n = await page.locator('.catrow').count(); assert(n >= 6); ok('分类「请求·拜托」有 ' + n + ' 张句子卡')
  await page.tap('[data-testid=cat-all]'); await page.waitForSelector('[data-testid=sent-zh]')
  const zh = await page.textContent('[data-testid=sent-zh]'); assert(/[一-鿿]/.test(zh)); assert(await page.locator('[data-testid=thai]').count() === 0); ok('卡片正面只有中文：' + zh)
  await page.tap('[data-testid=card]'); await page.waitForTimeout(700)
  const th = await page.textContent('[data-testid=back-thai]'); assert(/[฀-๿]/.test(th)); ok('翻面后是泰语：' + th)
  req.length = 0; await page.tap('[data-testid=next]'); await page.waitForTimeout(700)
  assert(req.length === 0, '前进时不该提前读泰语：' + req.join(',')); assert(await page.locator('[data-testid=sent-zh]').count() === 1); ok('下一张：又是中文在前，没有提前读泰语')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/sc-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
