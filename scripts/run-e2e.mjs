#!/usr/bin/env node
// 并行跑全部端到端测试（e2e/*.mjs）。用法：先 `npm run build:all`（不带 BASE），再 `npm run test:e2e`。
// - 每个测试分配一个独立的安全端口（E2E_PORT），避免并行时撞端口或抽到浏览器禁用的端口
// - 失败的测试自动重跑一次（真实的失败两次都会失败；偶发的启动超时不会误报）
// - 可只跑部分：node scripts/run-e2e.mjs wheel dialogue
import { spawn } from 'child_process'
import { readdirSync } from 'fs'
import { cpus } from 'os'

const only = process.argv.slice(2)
const all = readdirSync('e2e').filter(f => f.endsWith('.mjs') && !f.startsWith('_')).map(f => f.slice(0, -4)).sort()
const tests = only.length ? all.filter(t => only.includes(t)) : all
const jobs = Number(process.env.E2E_JOBS) || Math.max(2, Math.min(4, cpus().length))
const TIMEOUT = 240_000

const runOne = (name, port) => new Promise(res => {
  const t0 = Date.now(); let out = ''
  const p = spawn('node', [`e2e/${name}.mjs`], { env: { ...process.env, E2E_PORT: String(port) }, detached: true })
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d)
  const timer = setTimeout(() => { out += '\n✗ 超时'; try { process.kill(-p.pid, 'SIGKILL') } catch { /* 已退出 */ } }, TIMEOUT)
  p.on('close', code => { clearTimeout(timer); res({ name, ok: code === 0, out, secs: Math.round((Date.now() - t0) / 1000) }) })
})

let nextPort = 8100
const queue = [...tests], results = []
const worker = async () => {
  for (let name = queue.shift(); name; name = queue.shift()) {
    let r = await runOne(name, nextPort++)
    if (!r.ok) { console.log(`↻ ${name} 失败，重跑一次…`); r = await runOne(name, nextPort++); r.retried = true }
    console.log(`${r.ok ? '✓' : '✗'} ${name}（${(r.out.match(/✓/g) || []).length} 项，${r.secs}s${r.retried ? '，重跑后' : ''}）`)
    results.push(r)
  }
}
await Promise.all(Array.from({ length: jobs }, worker))
const bad = results.filter(r => !r.ok)
for (const r of bad) console.log(`\n────── ${r.name} 的输出 ──────\n${r.out.trim().split('\n').slice(-25).join('\n')}`)
console.log(`\n${results.length - bad.length}/${results.length} 个测试通过${bad.length ? '；失败：' + bad.map(r => r.name).join('、') : ''}`)
process.exit(bad.length ? 1 : 0)
