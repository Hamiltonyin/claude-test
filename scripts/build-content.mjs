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
    const thai = o.theme === '句式' ? o.thai.trim().normalize('NFC').replace(/\s+/g, ' ') : normThai(o.thai); const day = Number(o.day) || dayFromName   // 句式卡片的泰文保留词间空格，方便阅读
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
    const list = Array.isArray(c.words) ? [...new Set(c.words.map(t => t.trim().normalize('NFC').replace(/\s+/g, ' ')))] : [...new Set(c.words.split(/\s+/).filter(Boolean).map(normThai))]   // 数组写法：整句卡片，保留空格
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
// 声调校对页：content/tones.json（每个词必须在词库里，且标注的声调必须和词库拼音一致）
if (existsSync('content/tones.json')) {
  const t = JSON.parse(readFileSync('content/tones.json', 'utf8'))
  for (const st of t.sets) for (const it of st.items) {
    const w = words.find(x => x.thai === normThai(it.th))
    if (!w) { console.error(`✗ 声调页 ${st.id} 的「${it.th}」不在词库中`); bad++ }
    else if (toneCodes(w.roman) !== it.tone) { console.error(`✗ 声调页「${it.th}」标注 ${it.tone}，词库拼音 ${w.roman} 是 ${toneCodes(w.roman)}`); bad++ }
  }
  writeFileSync('public/content/tones.json', JSON.stringify(t))
  console.log(`声调对比：${t.sets.length} 组`)
}
// 词语拆解：content/parts.txt。`词|部分1+部分2`（部分：泰文 | 泰文=释义 | 泰文/拼音=释义）；`词|整词|说明`
const extraClips = []
const partsOut = {}
const partClips = new Map()
if (existsSync('content/parts.txt')) {
  const lib = new Map(words.map(w => [w.thai, w]))
  for (const [i, raw] of readFileSync('content/parts.txt', 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue
    const [th0, rest, note] = line.split('|'); const th = normThai(th0)
    if (!rest) { console.error(`✗ parts.txt:${i + 1} 格式错误`); bad++; continue }
    if (!lib.has(th)) { console.error(`✗ parts.txt:${i + 1} 「${th}」不在词库中`); bad++; continue }
    if (rest === '整词') { partsOut[th] = { whole: true, note: note || '' }; continue }
    const parts = []
    for (const seg of rest.split('+')) {
      const m = seg.match(/^([^/=]+)(?:\/([^=]+))?(?:=(.+))?$/)
      if (!m) { console.error(`✗ parts.txt:${i + 1} 无法解析「${seg}」`); bad++; continue }
      const pth = normThai(m[1]); const w = lib.get(pth)
      const roman = m[2] || w?.roman; const zh = m[3] || w?.zh.split('；')[0]
      if (!roman || !zh) { console.error(`✗ parts.txt:${i + 1} 「${pth}」缺拼音或释义（词库里没有这个词，要写 泰文/拼音=释义）`); bad++; continue }
      let id = w?.id
      if (!id) { id = 'prt-' + wordIdFor(pth); partClips.set(id, pth) }
      parts.push({ th: pth, roman: roman.normalize('NFC'), zh, id })
    }
    if (parts.map(x => x.th).join('') !== th) { console.error(`✗ parts.txt:${i + 1} 「${th}」拼起来是「${parts.map(x => x.th).join('')}」`); bad++; continue }
    partsOut[th] = { parts, ...(note ? { why: note } : {}) }
  }
  writeFileSync('public/content/parts.json', JSON.stringify(partsOut))
  // 构词规律：content/roots.txt（部件|规律）；自动统计每个部件出现在哪些词里
  const roots = []
  if (existsSync('content/roots.txt')) for (const [i, raw] of readFileSync('content/roots.txt', 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue
    const [rth, rule] = line.split('|'); const th = normThai(rth)
    const members = Object.entries(partsOut).filter(([, v]) => v.parts?.some(p => p.th === th)).map(([w]) => w)
    const anyPart = Object.values(partsOut).flatMap(v => v.parts ?? []).find(p => p.th === th)
    const lw = words.find(w => w.thai === th)
    if (!anyPart && !lw) { console.error(`✗ roots.txt:${i + 1} 「${th}」没有出现在任何拆解里`); bad++; continue }
    roots.push({ th, roman: lw?.roman ?? anyPart.roman, zh: lw?.zh.split('；')[0] ?? anyPart.zh, id: lw?.id ?? anyPart.id, rule, members })
  }
  roots.sort((a, b) => b.members.length - a.members.length)
  writeFileSync('public/content/roots.json', JSON.stringify(roots))
  console.log(`构词规律：${roots.length} 个部件`)
}
// 句子逐词解释：content/sentence-notes.txt。`句子|词1/拼音=释义+词2=释义+…|为什么这样说`（拼接时忽略空格）。并入 parts.json，但不计入构词规律
if (existsSync('content/sentence-notes.txt')) {
  const lib = new Map(words.map(w => [w.thai, w])); const sentOut = {}
  const nsp = t => t.replace(/\s+/g, '')
  for (const [i, raw] of readFileSync('content/sentence-notes.txt', 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue
    const [th0, rest, why] = line.split('|'); const th = normThai(th0)
    const key = [...lib.keys()].find(k => nsp(k) === nsp(th))
    if (!rest || !why) { console.error(`✗ sentence-notes.txt:${i + 1} 格式错误（要有 句子|拆解|为什么）`); bad++; continue }
    if (!key) { console.error(`✗ sentence-notes.txt:${i + 1} 「${th}」不在词库中`); bad++; continue }
    const parts = []
    for (const seg of rest.split('+')) {
      const m = seg.match(/^([^/=]+)(?:\/([^=]+))?(?:=(.+))?$/)
      if (!m) { console.error(`✗ sentence-notes.txt:${i + 1} 无法解析「${seg}」`); bad++; continue }
      const pth = normThai(m[1]); const w = lib.get(pth)
      const roman = m[2] || w?.roman; const zh = m[3] || w?.zh.split('；')[0]
      if (!roman || !zh) { console.error(`✗ sentence-notes.txt:${i + 1} 「${pth}」缺拼音或释义`); bad++; continue }
      let id = w?.id
      if (!id) { id = 'prt-' + wordIdFor(pth); partClips.set(id, pth) }
      parts.push({ th: pth, roman: roman.normalize('NFC'), zh, id })
    }
    if (nsp(parts.map(x => x.th).join('')) !== nsp(key)) { console.error(`✗ sentence-notes.txt:${i + 1} 「${th}」拼起来是「${parts.map(x => x.th).join('')}」`); bad++; continue }
    sentOut[key] = { parts, why }
  }
  Object.assign(partsOut, sentOut)
  writeFileSync('public/content/parts.json', JSON.stringify(partsOut))
  console.log(`句子解释：${Object.keys(sentOut).length} 句`)
}
// 动词图集：content/verbs.json（每个动词必须在词库里）
if (existsSync('content/verbs.json')) {
  const v = JSON.parse(readFileSync('content/verbs.json', 'utf8'))
  for (const sec of v.sections) for (const it of sec.items) if (!words.some(w => w.thai === normThai(it.th))) { console.error(`✗ 动词图集 ${sec.id} 的「${it.th}」不在词库中`); bad++ }
  writeFileSync('public/content/verbs.json', JSON.stringify(v))
  console.log(`动词图集：${v.sections.length} 组，${v.sections.reduce((a, x) => a + x.items.length, 0)} 张图`)
}
// 记忆法：content/mnemonics.txt，`词|类型|一句话`，同一个词可多行
{
  const mn = {}
  if (existsSync('content/mnemonics.txt')) {
    const lib = new Set(words.map(w => w.thai))
    for (const [i, raw] of readFileSync('content/mnemonics.txt', 'utf8').split('\n').entries()) {
      const line = raw.trim(); if (!line || line.startsWith('#')) continue
      const [th0, t, ...rest] = line.split('|'); const th = normThai(th0); const x = rest.join('|').trim()
      if (!lib.has(th) || !t || !x) { console.error(`✗ mnemonics.txt:${i + 1} 「${th}」不在词库或缺内容`); bad++; continue }
      ;(mn[th] ??= []).push({ t: t.trim(), x })
    }
  }
  writeFileSync('public/content/mnemonics.json', JSON.stringify(mn))
  console.log(`记忆法：${Object.keys(mn).length} 个词`)
}
// 句式：content/patterns.json（30 个常用固定句式，每个带例句；例句生成 pat-NN-K 音频，男声）
if (existsSync('content/patterns.json')) {
  const pj = JSON.parse(readFileSync('content/patterns.json', 'utf8'))
  for (const pt of pj.patterns) for (const e of pt.ex) { if (!e.th || !e.roman || !e.zh) { console.error(`✗ 句式 ${pt.n} 缺字段`); bad++ } else extraClips.push({ id: e.clip, th: e.th, voice: 'th-TH-NiwatNeural' }) }
  writeFileSync('public/content/patterns.json', JSON.stringify(pj))
  console.log(`句式：${pj.patterns.length} 个，例句 ${pj.patterns.reduce((a, x) => a + x.ex.length, 0)} 句`)
}
// 量词：content/classifiers.json（30 个常用量词，每个带例句；例句生成 cls-NN 音频）
if (existsSync('content/classifiers.json')) {
  const cj = JSON.parse(readFileSync('content/classifiers.json', 'utf8'))
  for (const it of cj.items) { if (!words.some(w => w.thai === normThai(it.th))) { console.error(`✗ 量词「${it.th}」不在词库中`); bad++ } extraClips.push({ id: it.ex.clip, th: it.ex.th }) }
  writeFileSync('public/content/classifiers.json', JSON.stringify(cj))
  console.log(`量词：${cj.items.length} 个`)
}
// 歌词背诵：content/lyrics/*.txt。首行 `# id|标题|简介|emoji`；`== 小节名`；每行 `泰文|拼音（｜ 分词组）|中文`
const lyrics = []
const dirL = 'content/lyrics'
if (existsSync(dirL)) for (const f of readdirSync(dirL).filter(f => f.endsWith('.txt')).sort()) {
  let cur = null, n = 0
  for (const [i, raw] of readFileSync(`${dirL}/${f}`, 'utf8').split('\n').entries()) {
    const line = raw.trim(); if (!line) continue
    if (line.startsWith('# ')) { const [id, title, intro, emoji] = line.slice(2).split('|').map(x => x.trim()); cur = { id, title, intro, emoji, items: [] }; lyrics.push(cur); n = 0; continue }
    if (!cur) { console.error(`✗ ${f}:${i + 1} 缺少歌词头 # id|标题|简介|emoji`); bad++; continue }
    if (line.startsWith('== ')) { cur.items.push({ sec: line.slice(3).trim() }); continue }
    const c = line.split('|').map(x => x.trim().normalize('NFC'))
    if ((c.length !== 3 && c.length !== 4) || c.slice(0, 3).some(x => !x)) { console.error(`✗ ${f}:${i + 1} 需要 3 段：泰文|拼音|中文（可选第 4 段：视频起止秒 如 1.2-3.4）`); bad++; continue }
    let t
    if (c[3]) { const m = c[3].match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/); if (!m || +m[2] <= +m[1]) { console.error(`✗ ${f}:${i + 1} 起止秒格式应为 1.2-3.4`); bad++; continue } t = [+m[1], +m[2]] }
    n++; cur.items.push({ n, th: c[0], roman: c[1], zh: c[2], ...(t ? { t } : {}), clip: `lyr-${cur.id}-${String(n).padStart(2, '0')}` })
  }
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
    if ((c.length !== 4 && c.length !== 5) || c.slice(0, 4).some(x => !x)) { console.error(`✗ ${f}:${i + 1} 需要 4 段：说话人|泰文|拼音|中文（可选第 5 段：视频起止秒 如 1.2-3.4）`); bad++; continue }
    let t
    if (c[4]) { const m = c[4].match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/); if (!m || +m[2] <= +m[1]) { console.error(`✗ ${f}:${i + 1} 起止秒格式应为 1.2-3.4`); bad++; continue } t = [+m[1], +m[2]] }
    n++; cur.items.push({ n, who: c[0], me: c[0] === '我', th: c[1], roman: c[2], zh: c[3], ...(t ? { t } : {}), clip: `dlg-${cur.id}-${String(n).padStart(2, '0')}` })
  }
}
if (bad) { console.error(`${bad} 行对话校验失败，已中止`); process.exit(1) }
writeFileSync('public/content/dialogues.json', JSON.stringify(dialogues))
for (const [id, th] of partClips) clips.push({ id, th })
for (const c of extraClips) clips.push(c)
writeFileSync('public/content/lyrics.json', JSON.stringify(lyrics))
for (const d of lyrics) for (const it of d.items) if (it.clip) clips.push({ id: it.clip, th: it.th })
for (const d of dialogues) for (const it of d.items) if (it.clip) clips.push({ id: it.clip, th: it.th, ...(it.me || it.who === '快递员' ? { voice: 'th-TH-NiwatNeural' } : {}) })
writeFileSync('public/content/clips.json', JSON.stringify({ words: clips }))
console.log(`拆解：${Object.values(partsOut).filter(x => x.parts).length} 个词可拆，${Object.values(partsOut).filter(x => x.whole).length} 个整词说明，${partClips.size} 个新部件音频`)
console.log(`歌词：${lyrics.length} 首，共 ${lyrics.reduce((a, d) => a + d.items.filter(x => x.clip).length, 0)} 句`)
console.log(`对话：${dialogues.length} 段，共 ${dialogues.reduce((a, d) => a + d.items.filter(x => x.clip).length, 0)} 句`)
console.log(`词组：${Object.keys(phrases).length} 个词有词组，共 ${Object.values(phrases).reduce((a, e) => a + e.items.length, 0)} 条`)
console.log(`library.json: ${words.length} 词，${lessons.length} 天`)
