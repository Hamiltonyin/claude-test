// 关联词：分类页「关联词」组、卡片背面关联词、词库按关联排序
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5500 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]')
  await page.tap('[data-testid=tab-cats]'); await page.waitForSelector('[data-testid=cat-cl00]')
  assert((await page.textContent('[data-testid=cat-cl00]')).includes('尺寸大小')); ok('分类页有「关联词」组：尺寸大小（大/小/长/短/宽/窄/高/低/矮…）')
  await page.tap('[data-testid=cat-cl00]'); await page.waitForSelector('.catrow')
  const t = await page.locator('.catrow').allTextContents(); assert(t.some(x => x.includes('ใหญ่')) && t.some(x => x.includes('เล็ก'))); ok('「大」和「小」在同一组：' + t.length + ' 个词')
  await page.tap('.sheet .btn.sec:last-child').catch(() => {}); await page.keyboard.press('Escape')
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-library]')
  await page.tap('[data-testid=tab-library]'); await page.fill('[data-testid=search]', 'ใหญ่'); await page.waitForTimeout(400)
  await page.tap('[data-testid=word-row]'); await page.waitForSelector('[data-testid=card]'); await page.tap('[data-testid=card]'); await page.waitForSelector('[data-testid=related]', { timeout: 6000 })
  const rel = await page.textContent('[data-testid=related]'); assert(rel.includes('เล็ก') && rel.includes('尺寸大小')); ok('卡片背面「关联词」：大 → 小、长、短、宽、窄…')
  await page.tap('text=‹ 返回'); await page.fill('[data-testid=search]', '')
  await page.tap('[data-testid=chip-cluster]'); await page.waitForTimeout(400)
  const rows = await page.locator('[data-testid=word-row] .w').allTextContents()
  const i1 = rows.indexOf('ใหญ่'), i2 = rows.indexOf('เล็ก'); assert(i1 >= 0 && i2 >= 0 && Math.abs(i1 - i2) <= 3, `大/小 位置 ${i1} ${i2}`); ok(`词库「按关联排序」：大(${i1}) 和 小(${i2}) 挨在一起`)
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/related-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
