// 从拼音的一个音节（如 lɛ́ɛo、khâo、rák）查它的元音：泰文写法、长短、对应元音页的哪一张卡片。
// 拼音规则（全 App 统一）：长音写两个字母、短音写一个；元音后面跟的 i / o / u 是「尾音」（滑音），n m ng k t p 是尾辅音。
import { toneCodes, TONE_ZH } from './tone'

export interface VowelInfo { rom: string; th: string; len: '短' | '长' | '特殊'; desc: string; card?: string }

// 单元音和复合元音（和 content/vowels.json 的卡片一一对应：card 是卡片 id）
const BASE: VowelInfo[] = [
  { rom: 'a', th: 'อะ', len: '短', desc: '啊（短）', card: 'v01' }, { rom: 'aa', th: 'อา', len: '长', desc: '啊（长）', card: 'v02' },
  { rom: 'i', th: 'อิ', len: '短', desc: '衣（短）', card: 'v03' }, { rom: 'ii', th: 'อี', len: '长', desc: '衣（长）', card: 'v04' },
  { rom: 'ɯ', th: 'อึ', len: '短', desc: '嘴不圆的「嗯」（短）', card: 'v05' }, { rom: 'ɯɯ', th: 'อือ', len: '长', desc: '嘴不圆的「嗯」（长）', card: 'v06' },
  { rom: 'u', th: 'อุ', len: '短', desc: '乌（短）', card: 'v07' }, { rom: 'uu', th: 'อู', len: '长', desc: '乌（长）', card: 'v08' },
  { rom: 'e', th: 'เอะ', len: '短', desc: '「飞」的前半截（短）', card: 'v09' }, { rom: 'ee', th: 'เอ', len: '长', desc: '「飞」的前半截（长）', card: 'v10' },
  { rom: 'ɛ', th: 'แอะ', len: '短', desc: '比 e 嘴更开（短）', card: 'v11' }, { rom: 'ɛɛ', th: 'แอ', len: '长', desc: '比 e 嘴更开（长）', card: 'v12' },
  { rom: 'o', th: 'โอะ', len: '短', desc: '圆唇的「喔」（短）', card: 'v13' }, { rom: 'oo', th: 'โอ', len: '长', desc: '圆唇的「喔」（长）', card: 'v14' },
  { rom: 'ɔ', th: 'เอาะ', len: '短', desc: '嘴张大的「哦」（短）', card: 'v15' }, { rom: 'ɔɔ', th: 'ออ', len: '长', desc: '嘴张大的「哦」（长）', card: 'v16' },
  { rom: 'ə', th: 'เออะ', len: '短', desc: '放松的「鹅」（短）', card: 'v17' }, { rom: 'əə', th: 'เออ', len: '长', desc: '放松的「鹅」（长）', card: 'v18' },
  { rom: 'ia', th: 'เอีย', len: '长', desc: '衣 → 啊', card: 'v20' }, { rom: 'ɯa', th: 'เอือ', len: '长', desc: '嗯 → 啊', card: 'v22' },
  { rom: 'ua', th: 'อัว', len: '长', desc: '乌 → 啊', card: 'v24' },
  { rom: 'ai', th: 'ไอ / ใอ', len: '特殊', desc: '爱', card: 'v27' }, { rom: 'ao', th: 'เอา', len: '特殊', desc: '奥', card: 'v28' },
]
// 元音 + 尾音（i / o / u）的组合：元音页上没有单独的卡片，这里写出泰文怎么拼
export const COMBOS: VowelInfo[] = [
  { rom: 'aai', th: '-าย', len: '长', desc: 'aa（อา）+ 尾音 i' }, { rom: 'aao', th: '-าว', len: '长', desc: 'aa（อา）+ 尾音 o' },
  { rom: 'iu', th: '-ิว', len: '短', desc: 'i（อิ）+ 尾音 u' }, { rom: 'iao', th: 'เ-ียว', len: '长', desc: 'ia（เอีย）+ 尾音 o' },
  { rom: 'ui', th: '-ุย', len: '短', desc: 'u（อุ）+ 尾音 i' }, { rom: 'uai', th: '-วย', len: '长', desc: 'ua（อัว）+ 尾音 i' },
  { rom: 'ooi', th: 'โ-ย', len: '长', desc: 'oo（โอ）+ 尾音 i' }, { rom: 'ɔi', th: '-อย（读短）', len: '短', desc: 'ɔ + 尾音 i' },
  { rom: 'ɔɔi', th: '-อย', len: '长', desc: 'ɔɔ（ออ）+ 尾音 i' }, { rom: 'əəi', th: 'เ-ย', len: '长', desc: 'əə（เออ）+ 尾音 i' },
  { rom: 'ɯai', th: 'เ-ือย', len: '长', desc: 'ɯa（เอือ）+ 尾音 i' }, { rom: 'eo', th: 'เ-็ว', len: '短', desc: 'e（เอะ）+ 尾音 o' },
  { rom: 'eeo', th: 'เ-ว', len: '长', desc: 'ee（เอ）+ 尾音 o' }, { rom: 'ɛɛo', th: 'แ-ว', len: '长', desc: 'ɛɛ（แอ）+ 尾音 o' },
]
const ALL = new Map([...BASE, ...COMBOS].map(v => [v.rom, v]))
const FINALS: Record<string, string> = { n: 'n（น）', m: 'm（ม）', ng: 'ng（ง）', k: 'k（ก）', t: 't（ด/ต）', p: 'p（บ/ป）' }

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase()

/** 分析一个音节。输入可以带声调符号（lɛ́ɛo），也可以是手打的近似写法（ae=ɛ、or=ɔ、oe=ə、ue=ɯ）。 */
export function lookupSyllable(raw: string) {
  const syl = raw.trim()
  let t = strip(syl).replace(/ue/g, 'ɯ').replace(/ae/g, 'ɛ').replace(/oe/g, 'ə').replace(/or(?![aeiou])/g, 'ɔɔ')
  const m = t.match(/^([^aeiouɛɔəɯ]*)([aeiouɛɔəɯ]+)(.*)$/)
  if (!m) return null
  const [, onset, run, fin] = m
  // 先找最长能对上的元音（含尾音），剩下的当尾辅音
  let nucleus = run, info = ALL.get(run)
  if (!info) for (let k = run.length - 1; k > 0 && !info; k--) { if (ALL.has(run.slice(0, k))) { nucleus = run.slice(0, k); info = ALL.get(nucleus) } }
  const tone = toneCodes(syl)
  const foreign = /\u0304/.test(syl.normalize('NFD')) || (!!fin && !FINALS[fin])   // 汉语拼音（ā）或对不上的尾巴：不是泰语音节
  return { syl, onset, nucleus, final: fin, finalNote: FINALS[fin] ?? '', info: foreign ? null : info ?? null, tone: TONE_ZH[tone] ?? '', spell: foreign ? '' : spellNote(nucleus, fin) }
}

/** 短元音后面有尾辅音时，泰文的写法会变（常让人在元音页「查不到」） */
function spellNote(nucleus: string, fin: string): string {
  if (!fin) return ''
  if (nucleus === 'a') return '短 a 后面有尾辅音时写成 -ั-（不写 ะ）：รัก、กัน、ฉัน'
  if (nucleus === 'o') return '短 o 后面有尾辅音时元音不写出来：คน、ผม、รถ'
  if (nucleus === 'e') return '短 e 后面有尾辅音时写成 เ-็：เย็น、เด็ก、เป็น'
  if (nucleus === 'ɛ') return '短 ɛ 后面有尾辅音时写成 แ-็：แข็ง'
  if (nucleus === 'ə' || nucleus === 'əə') return 'əə 后面有尾辅音时写成 เ-ิ：เกิด、เปิด、เดิน'
  if (nucleus === 'ua') return 'ua 后面有尾辅音时写成 -ว-（不写 ั）：ชวน、อ้วน'
  return ''
}
