// 生成 public/content/library.json：内置种子词 + content/*.csv（每天一个文件，如 content/day-003.csv）。
// 供 ① 应用在线合并新增课程 ② 音频生成脚本 使用。只新增，不会改动用户本地学习记录。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import * as seed from '../src/data/seed.ts'

import { parseCSV } from '../src/lib/csv.ts'
import { wordIdFor } from '../src/lib/ids.ts'
import { toneSummary, validateWord, normThai, toneCodes, isThai } from '../src/lib/tone.ts'

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
// 常用词组：content/phrases/*.txt，每行  词|词组泰文|声调码|带声调拼音|中文；词组必须包含该词，声调码须与拼音符号一致
const phrases = {}
const dirP = 'content/phrases'
if (existsSync(dirP)) for (const f of readdirSync(dirP).filter(f => f.endsWith('.txt')).sort()) {
  for (const [i, raw] of readFileSync(`${dirP}/${f}`, 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue
    const c = line.split('|').map(x => x.trim().normalize('NFC')); const where = `${f}:${i + 1} ${c[0]}`
    if (c.length !== 5) { console.error(`✗ ${where} 字段数 ${c.length}≠5`); bad++; continue }
    const [thai, th, tn, roman, zh] = c
    const id = byThai.get(normThai(thai))
    if (!id) { console.error(`✗ ${where} 词库里没有这个词`); bad++; continue }
    if (!isThai(th)) { console.error(`✗ ${where} 词组含非泰文`); bad++; continue }
    if (!th.replace(/\s+/g, '').includes(normThai(thai))) { console.error(`✗ ${where} 词组「${th}」不含该词`); bad++; continue }
    if (toneCodes(roman) !== tn) { console.error(`✗ ${where} 拼音声调 ${toneCodes(roman)} ≠ 标注 ${tn} (${roman})`); bad++; continue }
    if (!zh) { console.error(`✗ ${where} 缺中文`); bad++; continue }
    const e = (phrases[normThai(thai)] ??= { id, items: [] })
    if (!e.items.some(x => x.th === th)) e.items.push({ th, roman, zh })
  }
}
if (bad) { console.error(`${bad} 行校验失败，已中止`); process.exit(1) }
lessons.sort((a, b) => a.day - b.day)
mkdirSync('public/content', { recursive: true })
writeFileSync('public/content/library.json', JSON.stringify({ words, lessons }))
writeFileSync('public/content/phrases.json', JSON.stringify(phrases))
// 例句/词组的朗读清单（给音频脚本用）：<词ID>_ex = 例句，<词ID>_p<N> = 第 N 个词组
const clips = []
for (const w of words) clips.push({ id: w.id + '_ex', th: w.exTh })
for (const e of Object.values(phrases)) e.items.forEach((x, i) => clips.push({ id: `${e.id}_p${i}`, th: x.th }))
writeFileSync('public/content/clips.json', JSON.stringify({ words: clips }))
// 分类（按主题浏览，不受每天课程限制）：content/categories.json，词用泰文，必须是词库里已有的
if (existsSync('content/categories.json')) {
  const src = JSON.parse(readFileSync('content/categories.json', 'utf8'))
  let miss = 0
  const groups = src.groups.map(g => ({ name: g.name, icon: g.icon, own: !!g.own, cluster: !!g.cluster, cats: g.cats.map(c => {
    const list = [...new Set(c.words.split(/\s+/).filter(Boolean).map(normThai))]
    for (const t of list) if (!byThai.has(t)) { console.error(`✗ 分类「${c.name}」里的「${t}」不在词库中`); miss++ }
    return { id: c.id, name: c.name, emoji: c.emoji, words: list.filter(t => byThai.has(t)) }
  }) }))
  if (miss) { console.error(`${miss} 个分类词不存在，已中止`); process.exit(1) }
  const used = new Set(groups.flatMap(g => g.cats.flatMap(c => c.words)))
  const left = words.filter(w => !used.has(w.thai)).map(w => w.thai)
  writeFileSync('public/content/categories.json', JSON.stringify({ groups }))
  console.log(`分类：${groups.reduce((a, g) => a + g.cats.length, 0)} 个；未归入任何分类的词 ${left.length} 个：${left.join(' ')}`)
}
// 元音发音页：content/vowels.json（例词必须在词库里；carrier 是合成语音用的示范音节；clip 是老师视频里的起止秒数，视频本身不进仓库）
if (existsSync('content/vowels.json')) {
  const v = JSON.parse(readFileSync('content/vowels.json', 'utf8'))
  for (const e of v.vowels) for (const t of e.ex) if (!byThai.has(normThai(t))) { console.error(`✗ 元音 ${e.id} 的例词「${t}」不在词库中`); bad++ }
  writeFileSync('public/content/vowels.json', JSON.stringify(v))
  for (const e of v.vowels) if (e.carrier) clips.push({ id: `vow-${e.id}`, th: e.carrier })
  console.log(`元音：${v.vowels.length} 个`)
}
// 情景对话：content/dialogues/*.txt。首行 `# id|标题|场景|emoji`；`== 小节名`；每行 `说话人|泰文|拼音|中文`（说话人「我」显示在右边）
const dialogues = []
const dirD = 'content/dialogues'
if (existsSync(dirD)) for (const f of readdirSync(dirD).filter(f => f.endsWith('.txt')).sort()) {
  let cur = null, n = 0
  for (const [i, raw] of readFileSync(`${dirD}/${f}`, 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line) continue
    if (line.startsWith('# ')) { const [id, title, scene, emoji] = line.slice(2).split('|').map(x => x.trim()); cur = { id, title, scene, emoji, items: [] }; dialogues.push(cur); n = 0; continue }
    if (!cur) { console.error(`✗ ${f}:${i + 1} 缺少对话头 # id|标题|场景|emoji`); bad++; continue }
    if (line.startsWith('== ')) { cur.items.push({ sec: line.slice(3).trim() }); continue }
    const c = line.split('|').map(x => x.trim().normalize('NFC'))
    if (c.length !== 4 || c.some(x => !x)) { console.error(`✗ ${f}:${i + 1} 需要 4 段：说话人|泰文|拼音|中文`); bad++; continue }
    n++; cur.items.push({ n, who: c[0], me: c[0] === '我', th: c[1], roman: c[2], zh: c[3], clip: `dlg-${cur.id}-${String(n).padStart(2, '0')}` })
  }
}
if (bad) { console.error(`${bad} 行对话校验失败，已中止`); process.exit(1) }
writeFileSync('public/content/dialogues.json', JSON.stringify(dialogues))
for (const d of dialogues) for (const it of d.items) if (it.clip) clips.push({ id: it.clip, th: it.th, ...(it.me ? { voice: 'th-TH-NiwatNeural' } : {}) })
writeFileSync('public/content/clips.json', JSON.stringify({ words: clips }))
console.log(`对话：${dialogues.length} 段，共 ${dialogues.reduce((a, d) => a + d.items.filter(x => x.clip).length, 0)} 句`)
console.log(`词组：${Object.keys(phrases).length} 个词有词组，共 ${Object.values(phrases).reduce((a, e) => a + e.items.length, 0)} 条`)
console.log(`library.json: ${words.length} 词，${lessons.length} 天`)
