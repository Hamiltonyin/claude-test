import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backup, Level, Lesson, Progress, ReviewLog, Session, Settings, Word } from './types'
import { clearStores, loadAll, put, putMany, saveSettings } from './lib/db'
import { SEED_LESSONS, SEED_LEVELS, SEED_VERSION, SEED_WORDS } from './data/seed'
import { applyRating, buildSession } from './lib/srs'
import { addDays, today } from './lib/dates'
import { toneSummary } from './lib/tone'
import { wordIdFor } from './lib/ids'

interface Ctx {
  ready: boolean; error: string | null
  words: Word[]; wordMap: Map<string, Word>; lessons: Lesson[]; progress: Map<string, Progress>
  logs: ReviewLog[]; sessions: Session[]; settings: Settings; session: Session | null
  rate(wordId: string, level: Level): Promise<void>
  updateSettings(p: Partial<Settings>): Promise<void>
  addWords(words: Word[], lessonAdds: { day: number; wordIds: string[] }[]): Promise<void>
  updateWord(w: Word): Promise<void>
  exportBackup(): Backup
  restoreBackup(b: Backup, mode: 'replace' | 'merge'): Promise<void>
  mergeLibrary(words: Word[], lessons: Lesson[]): Promise<number>
  rebuildSession(): Promise<void>
}
const C = createContext<Ctx>(null as any)
export const useApp = () => useContext(C)

const defaultSettings = (): Settings => ({ startDate: today(), dayOffset: 2, dailyGoal: 30, reviewCap: 15, autoPlay: true, seedVersion: 0 })

function seedData() {
  const words: Word[] = SEED_WORDS.map(w => ({ id: w.id, thai: w.thai, roman: w.roman, tones: toneSummary(w.roman), zh: w.zh, theme: w.theme, exTh: w.exTh, exRoman: w.exRoman, exZh: w.exZh, builtin: true, createdAt: 0 }))
  const idOf = new Map(words.map(w => [w.thai, w.id]))
  const lessons: Lesson[] = Object.entries(SEED_LESSONS).map(([d, list]) => ({ day: Number(d), wordIds: list.map(t => idOf.get(t)!) }))
  return { words, lessons, idOf }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map())
  const [logs, setLogs] = useState<ReviewLog[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings())
  const ref = useRef({ words, lessons, progress, logs, sessions, settings })
  ref.current = { words, lessons, progress, logs, sessions, settings }

  useEffect(() => {
    (async () => {
      try {
        const data = await loadAll()
        const seed = seedData()
        let s = data.settings
        let ws = data.words, ls = data.lessons
        const pg = new Map(data.progress.map(p => [p.wordId, p]))
        if (!s) {
          // 首次运行：写入初始熟练度（只在首次；之后永不覆盖用户记录）
          s = defaultSettings()
          const yesterday = addDays(today(), -1)
          const initP: Progress[] = []
          for (const [lv, list] of Object.entries(SEED_LEVELS)) for (const t of list) {
            const id = seed.idOf.get(t)!
            const p = applyRating(undefined, id, Number(lv) as Level, yesterday)
            p.history = []; p.reps = 0; p.updatedAt = Date.now()
            initP.push(p); pg.set(id, p)
          }
          await putMany('progress', initP)
        }
        if (s.seedVersion < SEED_VERSION) {
          // 只补充缺失的内置词/课程，不触碰已有词条与进度
          const have = new Set(ws.map(w => w.id))
          const addW = seed.words.filter(w => !have.has(w.id))
          if (addW.length) { await putMany('words', addW); ws = [...ws, ...addW] }
          const haveL = new Set(ls.map(l => l.day))
          const addL = seed.lessons.filter(l => !haveL.has(l.day))
          if (addL.length) { await putMany('lessons', addL); ls = [...ls, ...addL] }
          s = { ...s, seedVersion: SEED_VERSION }
          await saveSettings(s)
        }
        let sess = data.sessions
        const date = today()
        if (!sess.some(x => x.date === date)) {
          const ns = buildSession({ words: ws, lessons: ls, progress: pg, settings: s, sessions: sess })
          await put('sessions', ns); sess = [...sess, ns]
        }
        setWords(ws); setLessons(ls); setProgress(pg); setLogs(data.logs); setSessions(sess); setSettings(s); setReady(true)
        navigator.storage?.persist?.().catch(() => {})
        // 在线时合并仓库里的新增课程（merge-only，不覆盖本地数据）
        fetch(`${import.meta.env.BASE_URL}content/library.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(async j => {
          if (j?.words) await mergeLibraryRef.current(j.words, j.lessons ?? [])
        }).catch(() => {})
      } catch (e: any) { setError(e?.message || String(e)) }
    })()
  }, [])

  const mergeLibrary = useCallback(async (nw: Word[], nl: Lesson[]) => {
    const cur = ref.current
    const have = new Set(cur.words.map(w => w.id))
    const thaiHave = new Set(cur.words.map(w => w.thai))
    const addW = nw.filter(w => !have.has(w.id) && !thaiHave.has(w.thai)).map(w => ({ ...w, tones: w.tones || toneSummary(w.roman) }))
    const idFix = new Map<string, string>() // 若内容里的 id 与本地同泰文不同，则以本地 id 为准
    for (const w of nw) { const loc = cur.words.find(x => x.thai === w.thai); if (loc && loc.id !== w.id) idFix.set(w.id, loc.id) }
    let changed = addW.length
    if (addW.length) { await putMany('words', addW); setWords(p => [...p, ...addW]) }
    const lessonsOut: Lesson[] = []
    for (const l of nl) {
      const ids = l.wordIds.map(i => idFix.get(i) ?? i)
      const ex = cur.lessons.find(x => x.day === l.day)
      if (!ex) { lessonsOut.push({ day: l.day, wordIds: ids }); changed++ }
      else { const add = ids.filter(i => !ex.wordIds.includes(i)); if (add.length) { lessonsOut.push({ day: l.day, wordIds: [...ex.wordIds, ...add] }); changed++ } }
    }
    if (lessonsOut.length) {
      await putMany('lessons', lessonsOut)
      setLessons(p => [...p.filter(x => !lessonsOut.some(o => o.day === x.day)), ...lessonsOut].sort((a, b) => a.day - b.day))
    }
    return changed
  }, [])
  const mergeLibraryRef = useRef(mergeLibrary); mergeLibraryRef.current = mergeLibrary

  const rate = useCallback(async (wordId: string, level: Level) => {
    const cur = ref.current
    const prev = cur.progress.get(wordId)
    const np = applyRating(prev, wordId, level)
    const log: ReviewLog = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: today(), wordId, level, prev: prev?.level ?? 0, ts: Date.now() }
    setProgress(m => new Map(m).set(wordId, np)); setLogs(l => [...l, log])
    await Promise.all([put('progress', np), put('logs', log)])
  }, [])

  const updateSettings = useCallback(async (p: Partial<Settings>) => {
    const s = { ...ref.current.settings, ...p }; setSettings(s); await saveSettings(s)
  }, [])

  const addWords = useCallback(async (nw: Word[], adds: { day: number; wordIds: string[] }[]) => {
    const cur = ref.current
    const have = new Set(cur.words.map(w => w.id))
    const fresh = nw.filter(w => !have.has(w.id))
    if (fresh.length) { await putMany('words', fresh); setWords(p => [...p, ...fresh]) }
    const out: Lesson[] = []
    for (const a of adds) {
      const ex = cur.lessons.find(l => l.day === a.day)
      const ids = [...(ex?.wordIds ?? [])]
      for (const id of a.wordIds) if (!ids.includes(id)) ids.push(id)
      out.push({ day: a.day, wordIds: ids })
    }
    if (out.length) {
      await putMany('lessons', out)
      setLessons(p => [...p.filter(x => !out.some(o => o.day === x.day)), ...out].sort((a, b) => a.day - b.day))
    }
  }, [])

  const updateWord = useCallback(async (w: Word) => {
    const nw = { ...w, tones: toneSummary(w.roman) }
    await put('words', nw); setWords(p => p.map(x => x.id === nw.id ? nw : x))
  }, [])

  const exportBackup = useCallback((): Backup => {
    const c = ref.current
    return { app: 'thai30', version: 1, exportedAt: Date.now(), words: c.words, lessons: c.lessons, progress: [...c.progress.values()], logs: c.logs, sessions: c.sessions, settings: c.settings }
  }, [])

  const restoreBackup = useCallback(async (b: Backup, mode: 'replace' | 'merge') => {
    const c = ref.current
    if (mode === 'replace') {
      await clearStores(['words', 'lessons', 'progress', 'logs', 'sessions'])
      await Promise.all([putMany('words', b.words), putMany('lessons', b.lessons), putMany('progress', b.progress), putMany('logs', b.logs ?? []), putMany('sessions', b.sessions ?? [])])
      const s = { ...defaultSettings(), ...b.settings, seedVersion: Math.max(b.settings?.seedVersion ?? 0, SEED_VERSION) }
      await saveSettings(s)
      setWords(b.words); setLessons(b.lessons); setProgress(new Map(b.progress.map(p => [p.wordId, p])))
      setLogs(b.logs ?? []); setSessions(b.sessions ?? []); setSettings(s)
    } else {
      // 合并：词条补缺；进度取 updatedAt 较新者；日志按 id 去重
      await mergeLibrary(b.words, b.lessons)
      const pm = new Map(c.progress)
      const changed: Progress[] = []
      for (const p of b.progress) { const e = pm.get(p.wordId); if (!e || p.updatedAt > e.updatedAt) { pm.set(p.wordId, p); changed.push(p) } }
      await putMany('progress', changed); setProgress(pm)
      const ids = new Set(c.logs.map(l => l.id)); const nl = (b.logs ?? []).filter(l => !ids.has(l.id))
      await putMany('logs', nl); setLogs(l => [...l, ...nl])
    }
  }, [mergeLibrary])

  const rebuildSession = useCallback(async () => {
    const c = ref.current
    const ns = buildSession({ words: c.words, lessons: c.lessons, progress: c.progress, settings: c.settings, sessions: c.sessions })
    await put('sessions', ns); setSessions(s => [...s.filter(x => x.date !== ns.date), ns])
  }, [])

  const wordMap = useMemo(() => new Map(words.map(w => [w.id, w])), [words])
  const session = sessions.find(s => s.date === today()) ?? null
  const value: Ctx = { ready, error, words, wordMap, lessons, progress, logs, sessions, settings, session, rate, updateSettings, addWords, updateWord, exportBackup, restoreBackup, mergeLibrary, rebuildSession }
  return <C.Provider value={value}>{children}</C.Provider>
}
export { wordIdFor }
