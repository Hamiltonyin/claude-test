import type { Level, Progress, Word, Session, Lesson, Settings } from '../types'
import { addDays, diffDays, today } from './dates'

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

/** 日历课程日：开始日 = 第 dayOffset+1 天，之后每过一个日历日 +1（不管你有没有打开应用） */
export const calendarDay = (settings: Settings, date: string) =>
  settings.dayOffset + 1 + Math.max(0, diffDays(date, settings.startDate))

/** 新词池：从未评过级的词。优先「今天及之后的课程」，再是不在课程里的词，最后才是更早课程里漏掉的词（那些走「补学」入口）。 */
export function newPool(words: Word[], lessons: Lesson[], progress: Map<string, Progress>, fromDay = 0): string[] {
  const later: string[] = [], earlier: string[] = [], seen = new Set<string>()
  for (const l of [...lessons].sort((a, b) => a.day - b.day)) for (const id of l.wordIds) if (!seen.has(id)) { seen.add(id); (l.day >= fromDay ? later : earlier).push(id) }
  const orphan = words.map(w => w.id).filter(id => !seen.has(id))
  return [...later, ...orphan, ...earlier].filter(id => (progress.get(id)?.level ?? 0) === 0)
}

export const newPerDay = (s: Settings) => s.newPerDay ?? 30

export const SESSION_VER = 2

/** 生成某天的课程：当天（日历第 N 天）课程里还没学过的词 = 新词，不足再按顺序补；外加到期复习词（陌生/不熟悉优先，上限 reviewCap）。 */
export function buildSession(args: {
  words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings; sessions: Session[]; date?: string
}): Session {
  const date = args.date ?? today()
  const dayNo = calendarDay(args.settings, date)
  const n = newPerDay(args.settings)
  const due = dueWords(args.progress, date).map(p => p.wordId)
  const reviewIds = due.slice(0, args.settings.reviewCap)
  const todays = (args.lessons.find(l => l.day === dayNo)?.wordIds ?? []).filter(id => (args.progress.get(id)?.level ?? 0) === 0)
  const newIds = [...todays]
  for (const id of newPool(args.words, args.lessons, args.progress, dayNo)) { if (newIds.length >= n) break; if (!newIds.includes(id)) newIds.push(id) }
  newIds.length = Math.min(newIds.length, n)
  return { date, dayNo, wordIds: [...reviewIds, ...newIds], reviewIds, newIds, ver: SESSION_VER }
}

/** 今天的课程新词不足时（例如新课程在课程生成之后才合并进来）用新词池补足；已有顺序与已评级的词不变。 */
export function topUpSession(session: Session, args: { words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings }): Session {
  const want = newPerDay(args.settings) - session.newIds.length
  if (want <= 0) return session
  const inSession = new Set(session.wordIds)
  const add = newPool(args.words, args.lessons, args.progress, session.dayNo).filter(id => !inSession.has(id)).slice(0, want)
  if (!add.length) return session
  return { ...session, wordIds: [...session.wordIds, ...add], newIds: [...session.newIds, ...add] }
}
