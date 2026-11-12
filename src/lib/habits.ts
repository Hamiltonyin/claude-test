import type { DailyCount, Progress, ReviewLog, Settings, Word } from '../types'
import { addDays, today } from './dates'

export interface Habits {
  hasData: boolean
  byHour: number[]; byWeekday: number[]
  activeDays30: number; longest: number; avgPerDay: number
  mix: { know: number; mid: number; hard: number; n: number }
  hardest: { id: string; flips: number }[]
  topics: { theme: string; n: number }[]
  overdue: number
  insights: string[]
}
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const part = (h: number) => h >= 5 && h < 9 ? '清晨' : h < 12 && h >= 9 ? '上午' : h >= 12 && h < 18 ? '下午' : h >= 18 && h < 23 ? '晚上' : '深夜'

/** 从学习日志、每日计数、翻卡次数里总结学习习惯（全部在本机计算）。 */
export function summarize(a: { parkedN?: number; logs: ReviewLog[]; daily: Record<string, DailyCount>; flips: Record<string, number>; plays: Record<string, number>; progress: Map<string, Progress>; words: Word[]; settings: Settings }): Habits {
  const { logs, flips, plays, progress, words, settings } = a
  const byHour = Array(24).fill(0), byWeekday = Array(7).fill(0)
  for (const l of logs) { byHour[new Date(l.ts).getHours()]++; byWeekday[new Date(l.date + 'T00:00:00').getDay()]++ }
  const perDay = new Map<string, Set<string>>()
  for (const l of logs) (perDay.get(l.date) ?? perDay.set(l.date, new Set()).get(l.date)!).add(l.wordId)
  const dates = [...perDay.keys()].sort()
  let longest = 0, run = 0, prev = ''
  for (const d of dates) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; longest = Math.max(longest, run); prev = d }
  const t = today(), since = addDays(t, -29)
  const activeDays30 = dates.filter(d => d >= since).length
  const avgPerDay = dates.length ? Math.round([...perDay.values()].reduce((s, x) => s + x.size, 0) / dates.length) : 0
  const recent = logs.slice(-200)
  const mix = { know: recent.filter(l => l.level >= 3).length, mid: recent.filter(l => l.level === 2).length, hard: recent.filter(l => l.level === 1).length, n: recent.length }
  const wm = new Map(words.map(w => [w.id, w]))
  const hardest = Object.entries(flips).filter(([id, n]) => n >= 3 && wm.has(id)).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([id, n]) => ({ id, flips: n }))
  const tc = new Map<string, number>()
  for (const p of progress.values()) if (p.reps > 0) { const th = wm.get(p.wordId)?.theme; if (th) tc.set(th, (tc.get(th) ?? 0) + 1) }
  const topics = [...tc].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([theme, n]) => ({ theme, n }))
  const overdue = [...progress.values()].filter(p => p.level > 0 && p.reps > 0 && (p.due ?? t) < t).length

  const insights: string[] = []
  if (!logs.length) insights.push('还没有学习记录。先学几个词，这里就会开始总结你的习惯。')
  else {
    const ph = byHour.indexOf(Math.max(...byHour)), pw = byWeekday.indexOf(Math.max(...byWeekday))
    const hourShare = Math.round((byHour[ph] / logs.length) * 100)
    insights.push(`时间：你最常在 ${ph} 点前后学习（${part(ph)}，占 ${hourShare}%），${WD[pw]}学得最多。`)
    insights.push(`坚持：近 30 天有 ${activeDays30} 天学习（${Math.round((activeDays30 / 30) * 100)}%），最长连续 ${longest} 天。`)
    insights.push(`量：学习的日子平均评级 ${avgPerDay} 个词，每日目标 ${settings.dailyGoal}。${avgPerDay >= settings.dailyGoal ? '达标 👍' : '还有空间，可以每天多加一两组。'}`)
    if (mix.n >= 10) {
      const k = Math.round((mix.know / mix.n) * 100)
      insights.push(`判断：最近 ${mix.n} 次里 ${k}% 直接「认识」，${Math.round((mix.mid / mix.n) * 100)}% 要再熟悉，${Math.round((mix.hard / mix.n) * 100)}% 要多看。${k >= 85 ? '「认识」很高——小心把「眼熟」当成「会用」，多做「举一反三」。' : k < 40 ? '不认识的偏多，新词量可以先降一点，把弱项听熟。' : '节奏比较均衡。'}`)
    }
  }
  const totalFlips = Object.values(flips).reduce((s, n) => s + n, 0), totalPlays = Object.values(plays).reduce((s, n) => s + n, 0)
  if (totalFlips + totalPlays > 0) insights.push(`听与看：累计翻卡 ${totalFlips} 次、听发音 ${totalPlays} 次${totalPlays < totalFlips ? '——听得比看得少，建议多开自动连读练耳朵。' : '。'}`)
  if (hardest.length) insights.push(`最费劲的词：${hardest.map(h => `${wm.get(h.id)!.thai}（翻 ${h.flips} 次）`).join('、')}，建议放进「验收」里重点练。`)
  if (topics.length) insights.push(`学得最多的主题：${topics.map(x => `${x.theme} ${x.n} 词`).join('、')}。`)
  if ((a.parkedN ?? 0) > 0) insights.push(`搁置：有 ${a.parkedN} 个词被你「忽略」了（近期用不上），它们暂时不进新词和复习，到期（60 天）或你手动恢复后才回来。`)
  if (overdue > 0) insights.push(`有 ${overdue} 个已学过的词逾期没复习，先清一清再学新词，记得更牢。`)
  return { hasData: logs.length > 0, byHour, byWeekday, activeDays30, longest, avgPerDay, mix, hardest, topics, overdue, insights }
}
