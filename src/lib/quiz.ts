import type { Word } from '../types'

/** 题型：listen 听音选意思；zh2th 看中文选泰语；cloze 例句填空（换个语境认出它）；th2zh 看泰语选意思 */
export type QType = 'listen' | 'zh2th' | 'cloze' | 'th2zh'
export interface Question { type: QType; word: Word; options: string[]; answer: string; prompt?: string; hint?: string }

export const shortZh = (z: string) => (z.split(/[；;]/)[0].replace(/（[^）]*）|\([^)]*\)/g, '').trim() || z)
const shuffle = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

/** 干扰项：优先同主题，且释义/泰文都不能与正确答案相同 */
function distract(w: Word, pool: Word[], key: (x: Word) => string, n = 3): string[] {
  const ans = key(w)
  const ok = pool.filter(x => x.id !== w.id && key(x) !== ans && shortZh(x.zh) !== shortZh(w.zh))
  const seen = new Set<string>([ans]), out: string[] = []
  for (const x of [...shuffle(ok.filter(x => x.theme === w.theme)), ...shuffle(ok)]) {
    const k = key(x); if (seen.has(k)) continue
    seen.add(k); out.push(k); if (out.length >= n) break
  }
  return out
}

function make(type: QType, w: Word, pool: Word[]): Question {
  if (type === 'listen' || type === 'th2zh') {
    const key = (x: Word) => shortZh(x.zh)
    return { type, word: w, answer: key(w), options: shuffle([key(w), ...distract(w, pool, key)]) }
  }
  const key = (x: Word) => x.thai
  const options = shuffle([key(w), ...distract(w, pool, key)])
  if (type === 'cloze') return { type, word: w, answer: w.thai, options, prompt: w.exTh.replace(w.thai, '＿＿＿'), hint: w.exZh }
  return { type, word: w, answer: w.thai, options, prompt: shortZh(w.zh) }
}

/** 验收（陌生/不熟悉 → 升一级）：2 题，看着认得即可 */
export const verifyQuestions = (w: Word, pool: Word[]): Question[] => [make('listen', w, pool), make('zh2th', w, pool)]

/** 举一反三（熟悉 → 精通）：3 题，换成例句语境/反向提问 */
export function masterQuestions(w: Word, pool: Word[]): Question[] {
  const qs: Question[] = []
  if (w.exTh.includes(w.thai) && w.exTh !== w.thai) qs.push(make('cloze', w, pool))
  qs.push(make('zh2th', w, pool), make('listen', w, pool))
  if (qs.length < 3) qs.push(make('th2zh', w, pool))
  return shuffle(qs).slice(0, 3)
}
