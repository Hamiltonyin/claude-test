import type { Lesson, Progress, ReviewLog, Session, Settings } from '../types'
import { addDays, today } from './dates'
import { calendarDay } from './srs'

export type DayStatus = 'done' | 'partial' | 'missed' | 'today' | 'none'
export interface DayRecord {
  date: string; dayNo: number; hasSession: boolean
  newIds: string[]; newDone: number
  reviewIds: string[]; reviewDone: number
  missedIds: string[]        // 这一天的新词里至今仍未学过的词（可补学）
  status: DayStatus
}

/** 从开始日到今天，逐日生成学习记录。没打开应用的日子也有记录（漏学），其新词 = 当天日历课程。 */
export function dayRecords(a: { settings: Settings; sessions: Session[]; lessons: Lesson[]; logs: ReviewLog[]; progress: Map<string, Progress>; endDate?: string }): DayRecord[] {
  const end = a.endDate ?? today()
  const ratedBy = new Map<string, Set<string>>()
  for (const l of a.logs) { let s = ratedBy.get(l.date); if (!s) ratedBy.set(l.date, s = new Set()); s.add(l.wordId) }
  const out: DayRecord[] = []
  for (let d = a.settings.startDate, guard = 0; d <= end && guard < 800; d = addDays(d, 1), guard++) {
    const s = a.sessions.find(x => x.date === d)
    const dayNo = calendarDay(a.settings, d)
    const newIds = s?.newIds ?? (a.lessons.find(l => l.day === dayNo)?.wordIds ?? [])
    const reviewIds = s?.reviewIds ?? []
    const rated = ratedBy.get(d) ?? new Set<string>()
    const newDone = newIds.filter(i => rated.has(i)).length
    const reviewDone = reviewIds.filter(i => rated.has(i)).length
    const missedIds = newIds.filter(i => (a.progress.get(i)?.level ?? 0) === 0)
    let status: DayStatus
    if (d === end && d === today()) status = 'today'
    else if (!newIds.length) status = 'none'
    else if (newDone >= newIds.length || missedIds.length === 0) status = 'done'
    else if (newDone > 0) status = 'partial'
    else status = 'missed'
    out.push({ date: d, dayNo, hasSession: !!s, newIds, newDone, reviewIds, reviewDone, missedIds, status })
  }
  return out
}

/** 所有过去未完成的日子里漏掉的新词（去重、按日期先后），用于「补学」 */
export function backlogIds(records: DayRecord[], exclude: Set<string> = new Set()): string[] {
  const seen = new Set<string>(), out: string[] = []
  for (const r of records) if (r.date !== today() && (r.status === 'missed' || r.status === 'partial'))
    for (const id of r.missedIds) if (!seen.has(id) && !exclude.has(id)) { seen.add(id); out.push(id) }
  return out
}
export const missedDays = (records: DayRecord[]) => records.filter(r => r.status === 'missed').length
