// 生成 jp/public/content/library.json 与 jp/src/data/library.json：
//   假名卡片（平假名/片假名：清音、浊音、半浊音、拗音 + 促音/长音）+ jp/content/src/words.txt 里的职场词汇
// 罗马音由读音自动生成；所有字段做强校验（读音必须是假名、不得重复……）。
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { SEION, DAKUON, YOON, HIRA_ORIGIN, KATA_ORIGIN, HIRA_EX, KATA_EX } from './kana-data.mjs'
import { toRomaji, hiraToKata, isKana } from '../src/lib/romaji.ts'

let bad = 0; const err = (m) => { console.error('✗', m); bad++ }
const hex = (s) => [...s].map(c => c.codePointAt(0).toString(16)).join('_')
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s.normalize('NFC')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }

const cards = [], lessons = []
const add = (c) => { cards.push({ builtin: true, createdAt: 0, note: '', exJp: '', exReading: '', exZh: '', ...c }); return c.id }

function kanaCard(ch, kind, section, row, col, extra = {}) {
  const hira = kind === 'kata' ? ch : ch   // ch 已是该书写系统的字符
  const romaji = toRomaji(ch)
  const ex = (kind === 'hira' ? HIRA_EX : KATA_EX)[ch]
  const label = kind === 'hira' ? '平假名' : '片假名'
  return add({
    id: (kind === 'hira' ? 'h_' : 'k_') + hex(ch), kind, jp: ch, reading: ch, romaji, speak: ch,
    zh: `${label} · 读 ${romaji}`, theme: label, grid: `${section}|${row}|${col}`,
    exJp: ex?.[0] ?? '', exReading: ex?.[1] ?? '', exZh: ex?.[2] ?? '', ...extra,
  })
}
const conv = (k, s) => (k === 'kata' ? hiraToKata(s) : s)
const seionIds = {}, dakuonIds = {}, yoonIds = {}
for (const kind of ['hira', 'kata']) {
  const O = kind === 'hira' ? HIRA_ORIGIN : KATA_ORIGIN
  const sys = kind === 'hira' ? '平假名' : '片假名'
  seionIds[kind] = {}; dakuonIds[kind] = {}; yoonIds[kind] = {}
  for (const [row, arr] of SEION) seionIds[kind][row] = arr.map((h, i) => { if (!h) return null; const ch = conv(kind, h)
    const o = O[ch]; return kanaCard(ch, kind, 'seion', row, i, { note: o ? (kind === 'hira' ? `来源：汉字「${o}」的草书简化` : `来源：汉字「${o}」的一部分`) : '' }) })
  for (const [row, arr] of DAKUON) dakuonIds[kind][row] = arr.map((h, i) => { const ch = conv(kind, h)
    const base = String.fromCharCode(h.charCodeAt(0) - (row === 'pa' ? 2 : 1)); const bc = conv(kind, row === 'pa' ? String.fromCharCode(h.charCodeAt(0) - 2) : base)
    const mark = row === 'pa' ? '半浊点「゜」' : '浊点「゛」'
    return kanaCard(ch, kind, 'dakuon', row, i, { note: `「${bc}」加${mark}` }) })
  for (const [row, arr] of YOON) yoonIds[kind][row] = arr.map((h, i) => { const ch = conv(kind, h)
    return kanaCard(ch, kind, 'yoon', row, i, { note: `「${conv(kind, h[0])}」＋小「${conv(kind, h[1])}」，合成一个音节（不是两拍）` }) })
}
// 特殊：促音、长音
const sokuon = add({ id: 'h_sokuon', kind: 'rule', jp: 'っ', reading: 'っ', romaji: '（双写辅音）', speak: 'がっこう', zh: '促音：小「っ」，停顿一拍，重复后面的辅音', theme: '平假名', grid: 'special|0|0', note: 'がっこう gakkou / ざっし zasshi：小っ不单独发音，让后面的辅音多停一拍', exJp: '学校', exReading: 'がっこう', exZh: '学校' })
const choon = add({ id: 'k_choon', kind: 'rule', jp: 'ー', reading: 'ー', romaji: '（拖长一拍）', speak: 'コーヒー', zh: '长音符号：把前一个元音拖长一拍', theme: '片假名', grid: 'special|0|0', note: '片假名用「ー」表示长音；平假名则用元音：おかあさん、おにいさん', exJp: 'コーヒー', exReading: 'コーヒー', exZh: '咖啡' })

const pick = (map, rows) => rows.flatMap(r => map[r]).filter(Boolean)
const L = (day, title, ids) => lessons.push({ day, title, wordIds: ids })
const H = (r) => seionIds.hira, K = seionIds.kata
L(1, '平假名① あ行・か行', pick(seionIds.hira, ['a', 'ka']))
L(2, '平假名② さ行・た行', pick(seionIds.hira, ['sa', 'ta']))
L(3, '平假名③ な行・は行', pick(seionIds.hira, ['na', 'ha']))
L(4, '平假名④ ま行・や行・ら行', pick(seionIds.hira, ['ma', 'ya', 'ra']))
L(5, '平假名⑤ わ行・ん + 浊音（が行・ざ行）', [...pick(seionIds.hira, ['wa', 'n']), ...pick(dakuonIds.hira, ['ga', 'za'])])
L(6, '平假名⑥ だ行・ば行 + 半浊音（ぱ行）', pick(dakuonIds.hira, ['da', 'ba', 'pa']))
L(7, '平假名⑦ 拗音（きゃ〜ひょ）', pick(yoonIds.hira, ['ky', 'sh', 'ch', 'ny', 'hy']))
L(8, '平假名⑧ 拗音（みゃ〜ぴょ）+ 促音「っ」', [...pick(yoonIds.hira, ['my', 'ry', 'gy', 'j', 'by', 'py']), sokuon])
L(9, '片假名① ア行・カ行', pick(seionIds.kata, ['a', 'ka']))
L(10, '片假名② サ行・タ行', pick(seionIds.kata, ['sa', 'ta']))
L(11, '片假名③ ナ行・ハ行', pick(seionIds.kata, ['na', 'ha']))
L(12, '片假名④ マ行・ヤ行・ラ行', pick(seionIds.kata, ['ma', 'ya', 'ra']))
L(13, '片假名⑤ ワ行・ン + 浊音（ガ行・ザ行）', [...pick(seionIds.kata, ['wa', 'n']), ...pick(dakuonIds.kata, ['ga', 'za'])])
L(14, '片假名⑥ ダ行・バ行 + 半浊音（パ行）', pick(dakuonIds.kata, ['da', 'ba', 'pa']))
L(15, '片假名⑦ 拗音（キャ〜ヒョ）', pick(yoonIds.kata, ['ky', 'sh', 'ch', 'ny', 'hy']))
L(16, '片假名⑧ 拗音（ミャ〜ピョ）+ 长音「ー」', [...pick(yoonIds.kata, ['my', 'ry', 'gy', 'j', 'by', 'py']), choon])

// ---- 职场词汇 ----
const OVERRIDE = {
  こんにちは: 'konnichiwa', こんばんは: 'konbanwa',
  // 长短语：加词间空格，便于阅读
  おつかれさまです: 'otsukaresama desu', しょうしょうおまちください: 'shoushou omachi kudasai', もうしわけありません: 'moushiwake arimasen',
  よろしくおねがいします: 'yoroshiku onegai shimasu', おさきにしつれいします: 'osaki ni shitsurei shimasu', ありがとうございます: 'arigatou gozaimasu',
  おはようございます: 'ohayou gozaimasu', ごちそうさまでした: 'gochisousama deshita', しょうちしました: 'shouchi shimashita', しつれいします: 'shitsurei shimasu',
  おねがいします: 'onegai shimasu', おせわになっております: 'osewa ni natte orimasu', おまたせしました: 'omatase shimashita',
  おいそがしいところ: 'oisogashii tokoro', ごかくにんください: 'gokakunin kudasai', しつれいいたします: 'shitsurei itashimasu',
  おそれいります: 'osore irimasu', でんわばんごう: 'denwa bangou', ひるごはん: 'hiru gohan', せきをはずす: 'seki o hazusu', おきゃくさま: 'okyakusama',
}
const seen = new Set(cards.map(c => c.jp)); let day = 0, title = '', cur = null
const KANA_OK = /^[ぁ-ゖァ-ヺー〜]+$/, SENT_OK = /^[ぁ-ゖァ-ヺー、。！？「」\s]+$/
for (const [i, raw] of readFileSync('jp/content/src/words.txt', 'utf8').split('\n').entries()) {
  const line = raw.trim(); if (!line) continue
  const m = line.match(/^#\s*day\s+(\d+)\s*(.*)$/i); if (m) { day = +m[1]; title = m[2]; cur = { day, title: `职场词汇 · ${title}`, wordIds: [] }; lessons.push(cur); continue }
  const f = line.split('|'); const where = `words.txt:${i + 1} ${f[0]}`
  if (f.length < 7 || f.length > 9) { err(`${where} 字段数 ${f.length}`); continue }
  const [jp, reading, zh, theme, exJp, exReading, exZh, note = '', rom = ''] = f.map(x => x.trim().normalize('NFC'))
  if (!KANA_OK.test(reading)) err(`${where} 读音必须是假名: ${reading}`)
  if (!SENT_OK.test(exReading)) err(`${where} 例句读音必须是假名: ${exReading}`)
  if (!zh || !exJp || !exZh) err(`${where} 缺字段`)
  if (seen.has(jp)) err(`${where} 重复`); seen.add(jp)
  const romaji = rom || OVERRIDE[reading] || toRomaji(reading)
  cur.wordIds.push(add({ id: 'w_' + fnv(jp), kind: 'word', jp, reading, romaji, speak: reading, zh, theme, note, exJp, exReading, exZh }))
}
// 校验：id 唯一、课程内 id 都存在
const ids = new Set(cards.map(c => c.id)); if (ids.size !== cards.length) err('id 冲突')
for (const l of lessons) for (const id of l.wordIds) if (!ids.has(id)) err(`课程 ${l.day} 缺 ${id}`)
if (bad) { console.error(`${bad} 个问题，未通过`); process.exit(1) }
const out = JSON.stringify({ words: cards, lessons })
mkdirSync('jp/public/content', { recursive: true }); mkdirSync('jp/src/data', { recursive: true })
writeFileSync('jp/public/content/library.json', out); writeFileSync('jp/src/data/library.json', out)
const k = cards.filter(c => c.kind !== 'word').length
console.log(`卡片 ${cards.length}（假名/规则 ${k}，词汇 ${cards.length - k}），课程 ${lessons.length} 天`)
for (const l of lessons) console.log(`  第${l.day}天 ${l.wordIds.length} 张  ${l.title}`)
