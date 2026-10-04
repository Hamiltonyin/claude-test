// 生成 public/content/library.json：内置种子词 + content/*.csv（每天一个文件，如 content/day-003.csv）。
// 供 ① 应用在线合并新增课程 ② 音频生成脚本 使用。只新增，不会改动用户本地学习记录。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import * as seed from '../src/data/seed.ts'

import { parseCSV } from '../src/lib/csv.ts'
import { wordIdFor } from '../src/lib/ids.ts'
import { toneSummary, validateWord, normThai } from '../src/lib/tone.ts'

const words = seed.SEED_WORDS.map(w => ({ id: w.id, thai: w.thai, roman: w.roman, tones: toneSummary(w.roman), zh: w.zh, theme: w.theme, exTh: w.exTh, exRoman: w.exRoman, exZh: w.exZh, builtin: true, createdAt: 0 }))
const byThai = new Map(words.map(w => [w.thai, w.id]))
const lessons = Object.entries(seed.SEED_LESSONS).map(([d, l]) => ({ day: Number(d), wordIds: l.map(t => byThai.get(t)) }))

let bad = 0
if (existsSync('content')) for (const f of readdirSync('content').filter(f => /\.csv$/i.test(f)).sort()) {
  const rows = parseCSV(readFileSync('content/' + f, 'utf8'))
  const head = rows[0].map(h => h.trim()); const cols = head.includes('thai') ? head : ['day', 'thai', 'roman', 'zh', 'theme', 'exTh', 'exRoman', 'exZh']
  const body = rows.slice(head.includes('thai') ? 1 : 0)
  const dayFromName = Number((f.match(/(\d+)/) || [])[1]) || undefined
  for (const r of body) {
    const o = Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()]))
    const thai = normThai(o.thai); const day = Number(o.day) || dayFromName
    const errs = validateWord({ thai, roman: o.roman.normalize('NFC'), zh: o.zh, exTh: o.exTh })
    if (!byThai.has(thai) && errs.length) { console.error(`✗ ${f} ${thai}: ${errs.join('；')}`); bad++; continue }
    if (!byThai.has(thai)) {
      const id = wordIdFor(thai); byThai.set(thai, id)
      words.push({ id, thai, roman: o.roman.normalize('NFC'), tones: toneSummary(o.roman), zh: o.zh, theme: o.theme || '日常交流', exTh: o.exTh, exRoman: o.exRoman.normalize('NFC'), exZh: o.exZh, createdAt: 0 })
    }
    if (day) { let l = lessons.find(x => x.day === day); if (!l) lessons.push(l = { day, wordIds: [] }); if (!l.wordIds.includes(byThai.get(thai))) l.wordIds.push(byThai.get(thai)) }
  }
}
if (bad) { console.error(`${bad} 行校验失败，已中止`); process.exit(1) }
lessons.sort((a, b) => a.day - b.day)
mkdirSync('public/content', { recursive: true })
writeFileSync('public/content/library.json', JSON.stringify({ words, lessons }))
console.log(`library.json: ${words.length} 词，${lessons.length} 天`)
