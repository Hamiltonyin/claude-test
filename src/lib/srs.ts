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

/** 「我录入的词」每天最多占几个新词位（额外加在每日 30 个新词之外，不挤占原课程） */
export const MINE_PER_DAY = 15

/** 今天的新词名单：先放「我录入的词」（最多 MINE_PER_DAY 个，不管今天是第几天），
 *  再放今天（日历第 N 天）课程里还没学过的词，不足 newPerDay 时按顺序补满。 */
function desiredNew(a: { words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings }, dayNo: number, existingNew: string[] = []): string[] {
  const lv = (id: string) => a.progress.get(id)?.level ?? 0
  const mineAll = myAddedIds(a.lessons)
  const mineAllSet = new Set(mineAll)
  // 每天「我录入的词」总共不超过 MINE_PER_DAY：今天名单里已有的（不管学没学）都占名额，学完一个不会再补新的
  const mineHave = existingNew.filter(id => mineAllSet.has(id))
  const room = Math.max(0, MINE_PER_DAY - mineHave.length)
  const mine = [...mineHave.filter(id => lv(id) === 0), ...mineAll.filter(id => lv(id) === 0 && !mineHave.includes(id)).slice(0, room)]
  const n = newPerDay(a.settings)
  const base = (a.lessons.find(l => l.day === dayNo)?.wordIds ?? []).filter(id => lv(id) === 0 && !mineAllSet.has(id))
  for (const id of newPool(a.words, a.lessons, a.progress, dayNo)) { if (base.length >= n) break; if (!mineAllSet.has(id) && !base.includes(id)) base.push(id) }
  base.length = Math.min(base.length, n)
  return [...mine, ...base]
}

/** 生成某天的课程：新词（见 desiredNew）+ 到期复习词（陌生/不熟悉优先，上限 reviewCap）。 */
export function buildSession(args: {
  words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings; sessions: Session[]; date?: string
}): Session {
  const date = args.date ?? today()
  const dayNo = calendarDay(args.settings, date)
  const due = dueWords(args.progress, date).map(p => p.wordId)
  const reviewIds = due.slice(0, args.settings.reviewCap)
  const newIds = desiredNew(args, dayNo)
  return { date, dayNo, wordIds: [...reviewIds, ...newIds], reviewIds, newIds, ver: SESSION_VER }
}

/** 课程内容后来才变化时（合并了新课程、新增了「我录入的词」）校正今天的新词名单：
 *  已经学过（评过级）的词保留；没学过、又不在目标名单里的凑数词被换掉；缺的词补进来。幂等。 */
export function topUpSession(session: Session, args: { words: Word[]; lessons: Lesson[]; progress: Map<string, Progress>; settings: Settings }): Session {
  const lv = (id: string) => args.progress.get(id)?.level ?? 0
  const desired = desiredNew(args, session.dayNo, session.newIds)
  const done = session.newIds.filter(id => lv(id) > 0)
  const newIds = [...done, ...desired.filter(id => !done.includes(id))]
  const wordIds = [...session.reviewIds, ...newIds]
  if (newIds.length === session.newIds.length && newIds.every((id, i) => id === session.newIds[i]) && wordIds.length === session.wordIds.length) return session
  return { ...session, wordIds, newIds }
}

/** 「我录入的词」：第 18 天起的课程（我跟泰国人学到的词，或在 App 里自己添加的词）。第 1~17 天是内置的 500 词课程。 */
export const USER_DAY_FROM = 18
export const myAddedIds = (lessons: Lesson[]): string[] => {
  const seen = new Set<string>(), out: string[] = []
  for (const l of [...lessons].sort((a, b) => a.day - b.day)) if (l.day >= USER_DAY_FROM) for (const id of l.wordIds) if (!seen.has(id)) { seen.add(id); out.push(id) }
  return out
}
