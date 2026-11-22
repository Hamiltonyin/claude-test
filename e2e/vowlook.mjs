// 查元音：元音页输入拼音音节 → 显示元音和泰文写法、能打开对应卡片；歌词滚轴里点拼音音节 → 弹出同样的元音说明
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = Number(process.env.E2E_PORT) || 7100 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=tab-cats]'); await page.tap('[data-testid=tab-cats]')
  await page.tap('[data-testid=open-vowels]'); await page.waitForSelector('[data-testid=vow-search]')
  await page.fill('[data-testid=vow-search]', 'lɛ́ɛo'); const t1 = await page.textContent('[data-testid=vinfo]'); assert(t1.includes('ɛɛo') && t1.includes('แ-ว'), t1); ok('元音页查 lɛ́ɛo → ɛɛo = แ-ว（元音 + 尾音）')
  await page.fill('[data-testid=vow-search]', 'thee'); const t2 = await page.textContent('[data-testid=vinfo]'); assert(t2.includes('เอ') && t2.includes('长'), t2); ok('查 thee → ee = เอ 长音')
  await page.tap('[data-testid=vow-jump]'); await page.waitForTimeout(400); assert(await page.locator('[data-vid=v10].on').count() === 1); ok('点「打开卡片」→ เอ 那张卡片展开')
  await page.fill('[data-testid=vow-search]', 'rák'); assert((await page.textContent('[data-testid=vinfo]')).includes('-ั-')); ok('查 rák → 提示短 a 后面有尾辅音时写成 -ั-')
  assert(await page.locator('[data-testid=vow-combos] .combo').count() >= 12); ok('元音页底部有「元音 + 尾音」表')
  // 歌词滚轴：点中间那句的拼音音节
  await page.tap('.sthead .close'); await page.tap('[data-testid=tab-cats]'); await page.tap('[data-testid=open-lyrics]'); await page.tap('[data-testid=lyr-yu-trong-nee]'); await page.waitForSelector('[data-testid=wheel]'); await page.waitForTimeout(400)
  await page.locator('[data-testid=wheel-item].on [data-testid=tap-syl]').first().tap(); await page.waitForSelector('[data-testid=vinfo]')
  assert((await page.textContent('[data-testid=vinfo]')).includes('元音')); ok('歌词滚轴：点拼音音节 → 下方弹出这个音节的元音说明')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/vl-fail.png' }) }
await b.close(); try { process.kill(-srv.pid) } catch {}; process.exit(bad ? 1 : 0)
