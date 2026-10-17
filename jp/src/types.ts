export type Level = 0 | 1 | 2 | 3 | 4 // 0未标记 1陌生 2不熟悉 3熟悉 4精通

/** 一张卡片：假名 / 规则 / 职场词汇 */
export interface Word {
  id: string; kind: 'hira' | 'kata' | 'rule' | 'word'
  jp: string            // 正面：假名或日文写法（可含汉字）
  reading: string       // 读音（假名）
  romaji: string; zh: string; note: string; theme: string
  exJp: string; exReading: string; exZh: string
  speak: string         // 交给语音合成的文本
  grid?: string         // 假名表位置 section|row|col
  builtin?: boolean; createdAt: number
}
export interface Lesson { day: number; wordIds: string[]; title?: string }
export interface Progress {
  wordId: string; level: Level; due: string | null; interval: number; streak: number
  reps: number; lapses: number; firstSeen?: string; updatedAt: number
  history: { t: number; l: Level }[]
}
export interface ReviewLog { id: string; date: string; wordId: string; level: Level; prev: Level; ts: number }
export interface Session { date: string; dayNo: number; wordIds: string[]; reviewIds: string[]; newIds: string[]; ver?: number }
export interface Settings {
  startDate: string; dayOffset: number; dailyGoal: number; reviewCap: number
  autoPlay: boolean; seedVersion: number; lastBackupAt?: number; newPerDay?: number; requeueStrange?: boolean
}
export interface Backup {
  app: 'nihongo'; version: 1; exportedAt: number
  words: Word[]; lessons: Lesson[]; progress: Progress[]; logs: ReviewLog[]; sessions: Session[]; settings: Settings
}
export const LEVEL_NAMES = ['未标记', '陌生', '不熟悉', '熟悉', '精通'] as const
export const LEVEL_COLORS = ['#c7ccd6', '#ff3b30', '#ff9500', '#007aff', '#34c759'] as const
