import type { ReviewLog, WordDaily } from '../types'
import { diffDays } from './dates'

export interface MemoryReport {
  words: number                      // 有学习日志的词数
  instant: number                    // 第一次看到就「认识」的词
  learned: { id: string; days: number; listens: number; perDay: number; activeDays: number }[]   // 一开始不熟、后来记熟的词
  avgDays: number | null; medianDays: number | null
  curve: { label: string; n: number; ok: number }[]       // 间隔 N 天后再看，还认识的比例（遗忘曲线）
  byRate: { label: string; n: number; avgDays: number }[]  // 记熟前平均每个学习日听读几次 → 平均几天记熟
  best: { label: string; avgDays: number; n: number } | null
}
const GAPS: [string, (g: number) => boolean][] = [['1 天', g => g === 1], ['2 天', g => g === 2], ['3 天', g => g === 3], ['4–7 天', g => g >= 4 && g <= 7], ['8–14 天', g => g >= 8 && g <= 14], ['15 天+', g => g >= 15]]
const RATES: [string, (r: number) => boolean][] = [['每天 1–2 次', r => r <= 2], ['每天 3–5 次', r => r > 2 && r <= 5], ['每天 6 次以上', r => r > 5]]

/** 从评级日志 + 每个词每天的听读次数，估计「记熟要几天」「间隔多久还记得」「每天读几次最快」。 */
export function analyzeMemory(logs: ReviewLog[], wd: WordDaily): MemoryReport {
  const by = new Map<string, ReviewLog[]>()
  for (const l of [...logs].sort((a, b) => a.ts - b.ts)) (by.get(l.wordId) ?? by.set(l.wordId, []).get(l.wordId)!).push(l)
  const curve = GAPS.map(([label]) => ({ label, n: 0, ok: 0 }))
  const learned: MemoryReport['learned'] = []
  let instant = 0
  for (const [id, ls] of by) {
    // 遗忘曲线：相邻两次不在同一天的评级，间隔天数 → 后一次是否「认识」(level>=3)
    for (let i = 1; i < ls.length; i++) {
      const g = diffDays(ls[i].date, ls[i - 1].date)
      if (g < 1) continue
      const k = GAPS.findIndex(([, f]) => f(g)); if (k < 0) continue
      curve[k].n++; if (ls[i].level >= 3) curve[k].ok++
    }
    const first = ls[0], m = ls.find(l => l.level >= 3)
    if (first.level >= 3) { instant++; continue }
    if (!m) continue
    const days = diffDays(m.date, first.date)
    const rec = wd[id] ?? {}
    let listens = 0, active = 0
    for (const [d, v] of Object.entries(rec)) if (d >= first.date && d <= m.date) { const n = v.p + v.e; listens += n; if (n > 0) active++ }
    learned.push({ id, days, listens, activeDays: active, perDay: active ? listens / active : 0 })
  }
  const ds = learned.map(x => x.days).sort((a, b) => a - b)
  const avgDays = ds.length ? Math.round((ds.reduce((a, b) => a + b, 0) / ds.length) * 10) / 10 : null
  const medianDays = ds.length ? ds[Math.floor(ds.length / 2)] : null
  const byRate = RATES.map(([label, f]) => {
    const g = learned.filter(x => x.activeDays > 0 && f(x.perDay))
    return { label, n: g.length, avgDays: g.length ? Math.round((g.reduce((a, b) => a + b.days, 0) / g.length) * 10) / 10 : 0 }
  })
  const ok = byRate.filter(x => x.n >= 3)
  const best = ok.length >= 2 ? [...ok].sort((a, b) => a.avgDays - b.avgDays)[0] : null
  return { words: by.size, instant, learned, avgDays, medianDays, curve, byRate, best }
}
