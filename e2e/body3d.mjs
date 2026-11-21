// 图解记忆 · 3D 人体：默认 3D；点模型选中部位并读音；点词条选中并转过去；脸部放大；可切回平面图
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7300 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
const mp3 = []; page.on('request', r => { if (/audio\/[^/]+\.mp3/.test(r.url())) mp3.push(r.url()) })
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.tap('[data-testid=open-pictures]'); await page.waitForSelector('[data-testid=body3d][data-ready="1"] canvas', { timeout: 20000 }); ok('人体页默认是 3D 模型（WebGL 画布已就绪）')
  const n = await page.locator('[data-testid=b3d-list] [data-testid=pic-tag]').count(); assert(n >= 30, 'parts ' + n); ok('可选部位 ' + n + ' 个')
  // 画面不是空白：读一下像素，应有不止一种颜色
  await page.waitForTimeout(600)
  const colors = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => { const c = document.querySelector('[data-testid=body3d] canvas'); const o = document.createElement('canvas'); o.width = 60; o.height = 100; const g = o.getContext('2d'); g.drawImage(c, 0, 0, 60, 100); const d = g.getImageData(0, 0, 60, 100).data; const s = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) s.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); res(s.size) }))))
  assert(colors >= 4, '画布颜色数 ' + colors); ok('模型画出来了（画布上有 ' + colors + ' 种色块）')
  // 点画布正中（躯干）→ 选中某个部位并读音
  const box = await page.locator('[data-testid=body3d]').boundingBox()
  mp3.length = 0; await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.42); await page.waitForTimeout(700)
  const sel1 = await page.getAttribute('[data-testid=body3d]', 'data-selected'); assert(sel1, '没有选中任何部位')
  assert((await page.textContent('[data-testid=b3d-sel]')).includes(sel1)); assert(mp3.length >= 1); ok('点模型中间 → 选中「' + sel1 + '」，下方显示这个词并读音')
  // 点词条「后背」→ 选中
  await page.locator('[data-testid=b3d-list] [data-testid=pic-tag]', { hasText: 'หลัง' }).first().tap(); await page.waitForTimeout(500)
  assert.equal(await page.getAttribute('[data-testid=body3d]', 'data-selected'), 'หลัง'); ok('点词条「หลัง 后背」→ 模型选中后背')
  // 点脸上的词 → 自动放大到脸部
  await page.locator('[data-testid=b3d-list] [data-testid=pic-tag]', { hasText: 'จมูก' }).first().tap(); await page.waitForTimeout(400)
  assert((await page.getAttribute('[data-testid=b3d-face]', 'class')).includes('on')); ok('点「จมูก 鼻子」→ 自动切到脸部放大')
  await page.tap('[data-testid=b3d-body]'); assert((await page.getAttribute('[data-testid=b3d-body]', 'class')).includes('on')); ok('可切回全身')
  await page.tap('[data-testid=body-2d]'); await page.waitForSelector('[data-testid=body-fig]'); ok('可切回平面图')
  await page.tap('[data-testid=body-3d]'); await page.waitForSelector('[data-testid=body3d] canvas'); ok('再切回 3D')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/b3d-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
