// 口头禅：对话「口头禅①」导入视频后每句已有预设起止秒；句式卡片分类「口头禅」有 33 张，翻面有逐词解释
import { chromium, devices } from 'playwright'
import { spawn, execSync } from 'child_process'
import assert from 'assert'
const port = 7500 + Math.floor(Math.random() * 90)
execSync('ffmpeg -v error -y -f lavfi -i testsrc=size=160x120:rate=10 -f lavfi -i sine=frequency=440 -t 16 -pix_fmt yuv420p -c:v libx264 -c:a aac /tmp/oral-rec.mp4')
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
await page.addInitScript(() => { try { localStorage.setItem('thai30-dlg-mode', '"chat"') } catch {} })
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=open-dialogues]'); await page.tap('[data-testid=open-dialogues]'); await page.waitForSelector('[data-testid=dlg-oral-1]')
  await page.tap('[data-testid=dlg-oral-1]'); await page.waitForSelector('[data-testid=bubble]')
  const n = await page.locator('[data-testid=bubble]').count(); assert(n === 13, 'lines ' + n); ok('「口头禅①」' + n + ' 句')
  await page.setInputFiles('[data-testid=dlg-vfile]', '/tmp/oral-rec.mp4'); await page.waitForSelector('[data-testid=dlg-video]'); await page.waitForTimeout(400)
  const first = await page.locator('[data-testid=dlg-vclip]').first().textContent(); assert(first.includes('1.0'), first); ok('导入视频后第 1 句已有预设时间：' + first.trim())
  const unset = await page.locator('[data-testid=dlg-vclip]:disabled').count(); assert(unset === 0, '未设置 ' + unset); ok('每一句都已有预设起止秒，无需手动设')
  await page.goBack().catch(() => {})
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.waitForSelector('[data-testid=cat-sent10]'); await page.tap('[data-testid=cat-sent10]'); await page.waitForSelector('[data-testid=cat-all]')
  const rows = await page.locator('.catrow').count(); assert(rows === 33, 'rows ' + rows); ok('句式卡片「口头禅」分类有 ' + rows + ' 张')
  await page.tap('[data-testid=cat-all]'); await page.waitForSelector('[data-testid=sent-zh]'); await page.tap('[data-testid=card]'); await page.waitForTimeout(600)
  assert(await page.locator('[data-testid=part-chip]').count() >= 2); assert((await page.textContent('[data-testid=parts-why]')).length > 10); ok('翻面后有逐词解释和「为什么这样说」')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/oral-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
