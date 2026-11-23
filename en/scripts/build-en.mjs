// 生成 en/public/content/library.json 与 en/src/data/library.json（来自 en/content/words.txt）
// 每行：英文|音标(可空，短语留空)|中文|主题|例句|例句中文|备注(可空)
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

let bad = 0; const err = (m) => { console.error('✗', m); bad++ }
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s.normalize('NFC')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
const cards = [], lessons = [], seen = new Set()
let cur = null
for (const [i, raw] of readFileSync('en/content/words.txt', 'utf8').split('\n').entries()) {
  const line = raw.trim(); if (!line) continue
  const m = line.match(/^#\s*day\s+(\d+)\s*(.*)$/i)
  if (m) { cur = { day: +m[1], title: m[2], wordIds: [] }; lessons.push(cur); continue }
  const f = line.split('|').map(x => x.trim().normalize('NFC')); const where = `words.txt:${i + 1} ${f[0]}`
  if (!cur) { err(`${where} 在第一个 # day 之前`); continue }
  if (f.length < 6 || f.length > 7) { err(`${where} 字段数 ${f.length}`); continue }
  const [en, ipa, zh, theme, exEn, exZh, note = ''] = f
  if (!/^[A-Za-z][A-Za-z0-9 '’,.?!-]*$/.test(en)) err(`${where} 英文里有奇怪的字符`)
  if (ipa && !/^\/[^/]+\/$/.test(ipa)) err(`${where} 音标要写成 /…/：${ipa}`)
  if (!zh || !theme || !exEn || !exZh) err(`${where} 缺字段`)
  if (/[一-鿿]/.test(exEn)) err(`${where} 英文例句里有中文`)
  const key = en.toLowerCase(); if (seen.has(key)) err(`${where} 重复`); seen.add(key)
  const id = 'e_' + fnv(key)
  cards.push({ id, kind: en.includes(' ') ? 'phrase' : 'word', en, ipa, zh, note, theme, exEn, exZh, speak: en, builtin: true, createdAt: 0 })
  cur.wordIds.push(id)
}
const ids = new Set(cards.map(c => c.id)); if (ids.size !== cards.length) err('id 冲突')
if (bad) { console.error(`${bad} 个问题，未通过`); process.exit(1) }
const out = JSON.stringify({ words: cards, lessons })
mkdirSync('en/public/content', { recursive: true }); mkdirSync('en/src/data', { recursive: true })
writeFileSync('en/public/content/library.json', out); writeFileSync('en/src/data/library.json', out)
console.log(`卡片 ${cards.length}（单词 ${cards.filter(c => c.kind === 'word').length}，短语 ${cards.filter(c => c.kind === 'phrase').length}），课程 ${lessons.length} 天`)
for (const l of lessons) console.log(`  第${l.day}天 ${l.wordIds.length} 张  ${l.title}`)
