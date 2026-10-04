// 数据校验：泰文字符、拼音声调符号与独立标注的声调一致、课程词条均存在、初始熟练度计数


import * as S from '../src/data/seed.ts'
const { SEED_WORDS, SEED_LESSONS, SEED_LEVELS } = S
const MARK = { '̀': 'L', '̂': 'F', '́': 'H', '̌': 'R' }
const toneOf = (roman) => roman.split(/[-\s]/).filter(Boolean).map(s => {
  for (const ch of s.normalize('NFD')) if (MARK[ch]) return MARK[ch]
  return 'M'
}).join('')
let bad = 0
const err = (m) => { console.error('✗', m); bad++ }
const thaiSet = new Set()
for (const w of SEED_WORDS) {
  if (!/^[฀-๿]+$/.test(w.thai)) err(`${w.id} 非纯泰文: ${w.thai}`)
  if (thaiSet.has(w.thai)) err(`重复词 ${w.thai}`); thaiSet.add(w.thai)
  if (toneOf(w.roman) !== w.tn) err(`${w.thai} 拼音声调 ${toneOf(w.roman)} ≠ 标注 ${w.tn} (${w.roman})`)
  if (!w.zh || !w.exTh || !w.exRoman || !w.exZh) err(`${w.thai} 缺字段`)
  if (!/^[฀-๿\s]+$/.test(w.exTh)) err(`${w.thai} 例句含非泰文`)
}
let entries = 0
for (const [d, list] of Object.entries(SEED_LESSONS)) {
  if (list.length !== 30) err(`第${d}天 ${list.length} 条`)
  entries += list.length
  for (const t of list) if (!thaiSet.has(t)) err(`第${d}天缺词 ${t}`)
}
const lv = Object.entries(SEED_LEVELS).map(([k, v]) => `${k}:${v.length}`).join(' ')
for (const v of Object.values(SEED_LEVELS)) for (const t of v) if (!thaiSet.has(t)) err(`熟练度缺词 ${t}`)
console.log(`词条 ${SEED_WORDS.length}，课程记录 ${entries}，熟练度 ${lv}`)
if (bad) { console.error(`${bad} 个问题`); process.exit(1) } else console.log('数据校验通过 ✓')
