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

export const newPerDay = (s: Settings) => s.newPerDay ?? 30

/** 生成当天课程：每天 newPerDay(默认30) 个新词 + 到期复习词（陌生/不熟悉优先，上限 reviewCap）。 */
export function buildSession(args: {
  words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings; sessions: Session[]; date?: string
}): Session {
  const date = args.date ?? today()
  const due = dueWords(args.progress, date).map(p => p.wordId)
  const pool = newPool(args.words, args.lessons, args.progress)
  const reviewIds = due.slice(0, args.settings.reviewCap)
  const newIds = pool.slice(0, newPerDay(args.settings))
  const dayNo = args.settings.dayOffset + args.sessions.filter(s => s.date !== date).length + 1
  return { date, dayNo, wordIds: [...reviewIds, ...newIds], reviewIds, newIds }
}

/** 今天的课程新词不足时（例如新课程在课程生成之后才合并进来）用新词池补足；已有顺序与已评级的词不变。 */
export function topUpSession(session: Session, args: { words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings }): Session {
  const want = newPerDay(args.settings) - session.newIds.length
  if (want <= 0) return session
  const inSession = new Set(session.wordIds)
  const add = newPool(args.words, args.lessons, args.progress).filter(id => !inSession.has(id)).slice(0, want)
  if (!add.length) return session
  return { ...session, wordIds: [...session.wordIds, ...add], newIds: [...session.newIds, ...add] }
}
