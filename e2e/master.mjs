// 熟悉→精通：举一反三练习通道；验收升一级；学习里不能直接点精通
import { chromium, devices } from 'playwright'
import { spawn } from 'child_process'
import assert from 'assert'
const port = 4600 + Math.floor(Math.random() * 90)
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise(r => setTimeout(r, 2500))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
let bad = 0; const ok = (n) => console.log('✓', n)
// 答题：按 data-right 选对/选错
const runWord = async (right) => {
  for (;;) {
    await page.waitForSelector('[data-testid=q-opt]')
    const sel = `[data-testid=q-opt][data-right="${right ? 1 : 0}"]`
    await page.locator(sel).first().tap()
    await page.tap('[data-testid=q-next]')
    return
  }
}
try {
  await page.goto(`http://localhost:${port}/`); await page.waitForSelector('[data-testid=start-master]')
  assert((await page.textContent('[data-testid=start-master]')).includes('熟悉 9')); ok('首页：熟悉 9 个，有「熟悉→精通」入口')
  // 学习里点精通 → 先记为熟悉
  await page.tap('[data-testid=start-weak]'); await page.waitForSelector('[data-testid=card]')
  await page.tap('[data-testid=card]'); await page.tap('[data-testid=rate4]')
  await page.waitForSelector('[data-testid=lock-msg]'); ok('学习里点「精通🔒」：提示要靠练习升级，先记为熟悉')
  await page.tap('text=‹ 返回')
  // 举一反三：第1个词全对，第2个词故意答错
  await page.tap('[data-testid=start-master]'); await page.waitForSelector('[data-testid=q-opt]')
  const total = Number((await page.textContent('.cnt')).split('/')[1]); assert(total >= 9 && total <= 10)
  for (let q = 0; q < 3; q++) await runWord(true)
  for (let q = 0; q < 3; q++) await runWord(q !== 0)
  for (let w = 2; w < total; w++) for (let q = 0; q < 3; q++) await runWord(true)
  await page.waitForSelector('[data-testid=practice-done]')
  const t = await page.textContent('[data-testid=practice-done]')
  assert(t.includes(`升级 ${total - 1} / ${total}`), t); ok(`全对升精通、答错保持：升级 ${total - 1}/${total}`)
  await page.tap('text=完成'); await page.waitForSelector('[data-testid=start-master]')
  assert((await page.textContent('[data-testid=start-master]')).includes('熟悉 1 个')); ok('首页熟悉数 10 → 1（9 个升精通，答错的 1 个保持）')
  // 验收
  await page.tap('[data-testid=start-verify]'); await page.waitForSelector('[data-testid=q-opt]')
  await runWord(true); await runWord(true)
  ok('验收：一个词 2 题全对')
  assert(errors.length === 0, errors.join('\n')); ok('无页面错误')
} catch (e) { bad++; console.error('✗', e.message); await page.screenshot({ path: '/tmp/master-fail.png' }) }
await b.close(); process.kill(-srv.pid); process.exit(bad ? 1 : 0)
