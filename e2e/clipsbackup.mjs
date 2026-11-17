// 视频时间轴备份：导出文件（下载/分享）→ 清空 → 从文件恢复
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
import fs from 'fs'
const port = 7600 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ ...devices['iPhone 14'], acceptDownloads: true })
const page = await ctx.newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
const idb = (fn, arg) => page.evaluate(async ([src, a]) => { const f = new Function('db', 'a', 'return (' + src + ')(db, a)'); const db = await new Promise((res, rej) => { const r = indexedDB.open('thai30'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }); return await f(db, a) }, [fn.toString(), arg])
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-me]')
  await idb((db) => new Promise(res => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ v12: [3, 4.5], v11: [1, 2] }, 'vowelClips'); tx.objectStore('meta').put({ 3: [2, 3.2] }, 'dlgclips:exp-real'); tx.oncomplete = () => res(true) }))
  await page.reload(); await page.waitForSelector('[data-testid=tab-me]'); await page.tap('[data-testid=tab-me]'); await page.waitForSelector('[data-testid=clips-export]')
  assert((await page.textContent('.panel:has([data-testid=clips-export]) .sub')).includes('3 条')); ok('「我的」页显示共 3 条时间轴')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('[data-testid=clips-export]')])
  const path = await dl.path(); const j = JSON.parse(fs.readFileSync(path, 'utf8'))
  assert(j.app === 'thai30-clips' && j.vowelClips.v12[0] === 3 && j.dlgclips['exp-real']['3'][1] === 3.2); ok('导出文件：thai30-clips-日期.json，内容正确')
  await idb((db) => new Promise(res => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').delete('vowelClips'); tx.objectStore('meta').delete('dlgclips:exp-real'); tx.oncomplete = () => res(true) }))
  await page.reload(); await page.waitForSelector('[data-testid=tab-me]'); await page.tap('[data-testid=tab-me]'); await page.waitForSelector('[data-testid=clips-import]', { state: 'attached' })
  assert((await page.textContent('.panel:has([data-testid=clips-export]) .sub')).includes('0 条')); ok('清空后 0 条')
  await page.setInputFiles('[data-testid=clips-import]', path); await page.waitForSelector('[data-testid=clips-msg]')
  const v = await idb((db) => new Promise(res => { const r = db.transaction('meta').objectStore('meta').get('vowelClips'); r.onsuccess = () => res(r.result) }))
  assert(v && v.v12[0] === 3); ok('从文件恢复：时间轴回来了')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/cb-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
