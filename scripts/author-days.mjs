// 从 content/src/*.txt 生成 content/day-0NN.csv，并做强校验。
// 行格式：thai|声调码|带声调拼音|中文|主题|例句泰文|例句拼音|例句中文
// 声调码 M中 L低 F降 H高 R升 —— 由作者按泰语规则独立推导，必须与拼音上的声调符号一致。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { toneCodes, isThai } from '../src/lib/tone.ts'
import { toCSV, CSV_HEADER } from '../src/lib/csv.ts'

const existing = new Map()
const lib = existsSync('public/content/library.json') ? JSON.parse(readFileSync('public/content/library.json', 'utf8')) : { words: [] }
// 仅与「不是由 src 生成的」词比较（避免重复运行时与自己冲突）
const srcDays = new Set()
const days = new Map()
let bad = 0
const err = (m) => { console.error('✗', m); bad++ }

for (const f of readdirSync('content/src').filter(f => f.endsWith('.txt')).sort()) {
  let day = 0
  for (const [i, raw] of readFileSync('content/src/' + f, 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line) continue
    const m = line.match(/^#\s*day\s+(\d+)/i); if (m) { day = Number(m[1]); srcDays.add(day); days.set(day, []); continue }
    const c = line.split('|'); const where = `${f}:${i + 1} ${c[0]}`
    if (c.length !== 8) { err(`${where} 字段数 ${c.length}≠8`); continue }
    const [thai, tn, roman, zh, theme, exTh, exRoman, exZh] = c.map(x => x.trim().normalize('NFC'))
    if (!isThai(thai)) err(`${where} 非纯泰文`)
    if (!isThai(exTh)) err(`${where} 例句含非泰文`)
    if (toneCodes(roman) !== tn) err(`${where} 拼音声调 ${toneCodes(roman)} ≠ 独立标注 ${tn} (${roman})`)
    if (!zh || !exRoman || !exZh) err(`${where} 缺字段`)
    days.get(day).push({ day, thai, roman, zh, theme, exTh, exRoman, exZh })
  }
}
// 重复检查
const all = new Map()
const libWords = lib.words.filter(w => { // library.json 里来自 src 日的词要排除
  const l = lib.lessons.filter(x => srcDays.has(x.day)); return !l.some(x => x.wordIds.includes(w.id)) })
for (const w of libWords) all.set(w.thai, 'existing')
for (const [d, rows] of days) for (const r of rows) {
  if (all.has(r.thai)) err(`重复词 ${r.thai}：第${d}天 与 ${all.get(r.thai)}`)
  all.set(r.thai, `第${d}天`)
}
for (const [d, rows] of [...days].sort((a, b) => a[0] - b[0])) {
  console.log(`第${d}天：${rows.length} 词`)
  writeFileSync(`content/day-${String(d).padStart(3, '0')}.csv`, toCSV([CSV_HEADER, ...rows.map(r => CSV_HEADER.map(k => r[k]))]))
}
const total = libWords.length + [...days.values()].reduce((a, b) => a + b.length, 0)
console.log('词库合计（含本次）：', total)
if (bad) { console.error(`\n${bad} 个问题，未通过`); process.exit(1) } else console.log('作者校验通过 ✓')
