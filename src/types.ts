export type Level = 0 | 1 | 2 | 3 | 4 // 0未标记 1陌生 2不熟悉 3熟悉 4精通

export interface Word {
  id: string; thai: string; roman: string; tones: string; zh: string; theme: string
  exTh: string; exRoman: string; exZh: string; builtin?: boolean; createdAt: number
}
export interface Lesson { day: number; wordIds: string[] }
export interface Progress {
  wordId: string; level: Level; due: string | null; interval: number; streak: number
  reps: number; lapses: number; firstSeen?: string; updatedAt: number
  history: { t: number; l: Level }[]
}
export interface ReviewLog { id: string; date: string; wordId: string; level: Level; prev: Level; ts: number }
export interface Session { date: string; dayNo: number; wordIds: string[]; reviewIds: string[]; newIds: string[]; ver?: number }
export interface Settings {
  startDate: string; dayOffset: number; dailyGoal: number; reviewCap: number
  autoPlay: boolean; seedVersion: number; lastBackupAt?: number; newPerDay?: number
}
export interface Backup {
  app: 'thai30'; version: 1; exportedAt: number
  words: Word[]; lessons: Lesson[]; progress: Progress[]; logs: ReviewLog[]; sessions: Session[]; settings: Settings
}
export const LEVEL_NAMES = ['未标记', '陌生', '不熟悉', '熟悉', '精通'] as const
export const LEVEL_COLORS = ['#c7ccd6', '#ff3b30', '#ff9500', '#007aff', '#34c759'] as const
