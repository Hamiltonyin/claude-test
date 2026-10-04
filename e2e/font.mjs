import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
const port = 4900 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
let bad = 0
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-today]')
  await page.tap('[data-testid=tab-me]')
  await page.fill('[data-testid=import-text]', 'day,thai,roman,zh,theme,exTh,exRoman,exZh\n3,ห้อง,hɔ̂ɔng,房间,居家,ห้องนี้ใหญ่,hɔ̂ɔng níi yài,这个房间很大。')
  await page.tap('[data-testid=import-parse]'); await page.waitForSelector('.pv')
  await page.tap('[data-testid=import-commit]'); await page.waitForTimeout(500)
  await page.tap('[data-testid=tab-library]'); await page.fill('[data-testid=search]', '房间'); await page.waitForTimeout(200)
  const fam = await page.evaluate(() => [...document.querySelectorAll('[lang=th],.th,.pv input')].map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))
  console.log('检查元素数', fam.length, '字体首选:', [...new Set(fam)])
  if (!fam.length || fam.some(f => f !== 'Sarabun')) bad++
  await page.tap('[data-testid=word-row]'); await page.waitForTimeout(200)
  const fam2 = await page.evaluate(() => [...document.querySelectorAll('.sheet *')].filter(e => /[฀-๿]/.test(e.childNodes[0]?.textContent || '') ).map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))
  console.log('新词详情中泰文元素', fam2.length, [...new Set(fam2)])
  if (!fam2.length || fam2.some(f => f !== 'Sarabun')) bad++
  const ok = await page.evaluate(() => document.fonts.check('40px "Sarabun"', 'ห้อง'))
  if (!ok) bad++
  await page.screenshot({ path: '/tmp/newword.png' })
} finally { try { process.kill(-srv.pid) } catch {}; await b.close() }
console.log(bad ? 'FAIL' : '新导入的词：字体全部为 Sarabun ✓'); process.exit(bad ? 1 : 0)
