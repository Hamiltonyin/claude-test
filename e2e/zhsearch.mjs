// 中文搜索：请 / 帮忙 / 怎么 / 如果；首页搜索框直达词库结果
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 5000 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const search = async (q) => {
  await page.tap('[data-testid=tab-home]'); await page.fill('[data-testid=home-search]', q); await page.tap('[data-testid=home-search-go]')
  await page.waitForSelector('[data-testid=word-row]'); await page.waitForTimeout(500)
  return page.locator('[data-testid=word-row]').allTextContents()
}
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=home-search]')
  let r = await search('帮忙'); assert(r[0].includes('ช่วย'), r[0]); ok('首页搜「帮忙」→ 第一条是 ช่วย')
  r = await search('如果'); assert(r[0].includes('ถ้า'), r[0]); ok('搜「如果」→ ถ้า')
  r = await search('怎么'); assert(r.slice(0, 3).some(x => x.includes('ยังไง')) && r.slice(0, 3).some(x => x.includes('อย่างไร')), r.slice(0, 3).join('|')); ok('搜「怎么」→ ยังไง / อย่างไร 排在前面')
  r = await search('发票'); assert(r[0].includes('ใบกำกับภาษี'), r[0]); assert(!r.some(x => x.includes('ใบเสร็จ') && x.includes('收据；小票') && !x.includes('词组') && !x.includes('例句')), '收据不应被当成发票'); ok('搜「发票」→ ใบกำกับภาษี 第一，收据 ใบเสร็จ 不再冒充发票')
  r = await search('请'); assert(r.length >= 4 && r.some(x => x.includes('ขอ')) && r.some(x => x.includes('เชิญ'))); ok(`搜「请」→ ${r.length} 个词，含 ขอ / เชิญ`)
  assert(r.some(x => x.includes('例句：') || x.includes('词组：')), '应有例句/词组命中'); ok('只在例句/词组里出现的词也能搜到，并标出来源')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/zh-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
