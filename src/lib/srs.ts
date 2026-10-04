import type { Level, Progress, Word, Session, Lesson, Settings } from '../types'
import { addDays, today } from './dates'

/** 评级后计算新的进度。陌生：当天会再出现，次日优先；不熟悉 1 天；熟悉 3 天；精通 7→14→30→60 天。降级则缩短并记一次遗忘。 */
export function applyRating(p: Progress | undefined, wordId: string, level: Level, date = today()): Progress {
  const prev: Progress = p ?? { wordId, level: 0, due: null, interval: 0, streak: 0, reps: 0, lapses: 0, updatedAt: 0, history: [] }
  const lowered = prev.level > level && prev.level !== 0
  let interval: number, streak = prev.streak
  if (level === 1) { interval = 0; streak = 0 }
  else if (level === 2) { interval = 1; streak = 0 }
  else if (level === 3) { interval = 3; streak = 0 }
  else {
    streak = lowered ? 1 : (prev.level === 4 ? prev.streak + 1 : 1)
    interval = [7, 14, 30, 60][Math.min(streak - 1, 3)]
  }
  return {
    ...prev, level, interval, streak,
    due: addDays(date, interval),
    reps: prev.reps + 1, lapses: prev.lapses + (lowered ? 1 : 0),
    firstSeen: prev.firstSeen ?? date, updatedAt: Date.now(),
    history: [...prev.history, { t: Date.now(), l: level }].slice(-30),
  }
}

const isDue = (p: Progress, date: string) => p.level > 0 && (p.due ?? date) <= date

/** 到期复习词，陌生/不熟悉优先，其次越逾期越靠前 */
export function dueWords(progress: Map<string, Progress>, date = today(), maxLevel: Level = 4): Progress[] {
  return [...progress.values()].filter(p => p.level > 0 && p.level <= maxLevel && isDue(p, date))
    .sort((a, b) => a.level - b.level || (a.due ?? '').localeCompare(b.due ?? '') || a.wordId.localeCompare(b.wordId))
}
/** 重点复习：所有陌生 + 不熟悉词（不论是否到期），陌生在前 */
export function weakWords(progress: Map<string, Progress>): Progress[] {
  return [...progress.values()].filter(p => p.level === 1 || p.level === 2)
    .sort((a, b) => a.level - b.level || (a.due ?? '').localeCompare(b.due ?? ''))
}

/** 新词池：从未评过级的词，按课程顺序（第几天、天内顺序）排序，不在任何课程里的词排最后 */
export function newPool(words: Word[], lessons: Lesson[], progress: Map<string, Progress>): string[] {
  const order: string[] = []
  const seen = new Set<string>()
  for (const l of [...lessons].sort((a, b) => a.day - b.day)) for (const id of l.wordIds) if (!seen.has(id)) { seen.add(id); order.push(id) }
  for (const w of words) if (!seen.has(w.id)) { seen.add(w.id); order.push(w.id) }
  return order.filter(id => (progress.get(id)?.level ?? 0) === 0)
}

/** 生成当天 30 词：先取到期复习词（陌生/不熟悉优先，上限 reviewCap），其余为新词；新词不足时补更多复习词。 */
export function buildSession(args: {
  words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings; sessions: Session[]; date?: string
}): Session {
  const date = args.date ?? today()
  const goal = args.settings.dailyGoal
  const due = dueWords(args.progress, date).map(p => p.wordId)
  const pool = newPool(args.words, args.lessons, args.progress)
  let reviewIds = due.slice(0, Math.min(args.settings.reviewCap, goal))
  const reviewSet = new Set(reviewIds)
  let newIds = pool.slice(0, goal - reviewIds.length)
  if (reviewIds.length + newIds.length < goal) {
    const more = due.filter(id => !reviewSet.has(id)).slice(0, goal - reviewIds.length - newIds.length)
    reviewIds = [...reviewIds, ...more]
  }
  // 新词与复习词穿插：复习词放前面（先热身），之后是新词
  const dayNo = args.settings.dayOffset + args.sessions.filter(s => s.date !== date).length + 1
  return { date, dayNo, wordIds: [...reviewIds, ...newIds], reviewIds, newIds }
}
