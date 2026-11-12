import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backup, DailyCount, Level, Lesson, Progress, ReviewLog, Session, Settings, Word } from './types'
import { clearStores, db, loadAll, put, putMany, saveSettings } from './lib/db'
import { SEED_LESSONS, SEED_LEVELS, SEED_VERSION, SEED_WORDS } from './data/seed'
import { applyRating, buildSession, topUpSession, calendarDay, dueWords, SESSION_VER } from './lib/srs'
import { addDays, today } from './lib/dates'
import { toneSummary } from './lib/tone'
import { wordIdFor } from './lib/ids'

interface Ctx {
  ready: boolean; error: string | null
  words: Word[]; wordMap: Map<string, Word>; lessons: Lesson[]; progress: Map<string, Progress>
  logs: ReviewLog[]; sessions: Session[]; settings: Settings; session: Session | null
  flips: Record<string, number>; countFlip(wordId: string): void
  plays: Record<string, number>; countPlay(wordId: string): void
  exPlays: Record<string, number>; countExPlay(wordId: string): void
  daily: Record<string, DailyCount>
  parked: Record<string, string>; parkedSet: Set<string>; parkWord(wordId: string, days?: number): void; unparkWord(wordId: string): void
  rate(wordId: string, level: Level): Promise<void>
  updateSettings(p: Partial<Settings>): Promise<void>
  addWords(words: Word[], lessonAdds: { day: number; wordIds: string[] }[]): Promise<void>
  updateWord(w: Word): Promise<void>
  exportBackup(): Backup
  restoreBackup(b: Backup, mode: 'replace' | 'merge'): Promise<void>
  mergeLibrary(words: Word[], lessons: Lesson[]): Promise<number>
  rebuildSession(): Promise<void>
  growReviews(cap: number): Promise<void>
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
  const [todayStr, setTodayStr] = useState(today())
  const [flips, setFlips] = useState<Record<string, number>>({})
  const flipsRef = useRef(flips); flipsRef.current = flips
  const [plays, setPlays] = useState<Record<string, number>>({})
  const playsRef = useRef(plays); playsRef.current = plays
  const [exPlays, setExPlays] = useState<Record<string, number>>({})
  const exRef = useRef(exPlays); exRef.current = exPlays
  const [parked, setParked] = useState<Record<string, string>>({})
  const parkedRef = useRef(parked); parkedRef.current = parked
  // 「近期用不上」的词：到期日之前不进新词、不进复习
  const skipNow = () => new Set(Object.entries(parkedRef.current).filter(([, u]) => u > today()).map(([id]) => id))
  const parkedSet = useMemo(() => new Set(Object.entries(parked).filter(([, u]) => u > today()).map(([id]) => id)), [parked, todayStr])
  const [daily, setDaily] = useState<Record<string, DailyCount>>({})
  const dailyRef = useRef(daily); dailyRef.current = daily
  const bumpDaily = useCallback((field: keyof DailyCount) => {
    const d = today(), cur = dailyRef.current[d] ?? { flips: 0, plays: 0, ex: 0 }
    const n = { ...dailyRef.current, [d]: { ...cur, [field]: cur[field] + 1 } }
    dailyRef.current = n; setDaily(n); void put('meta', n, 'daily')
  }, [])
  const ref = useRef({ words, lessons, progress, logs, sessions, settings })
  ref.current = { words, lessons, progress, logs, sessions, settings }

  useEffect(() => { db().then(d => d.get('meta', 'plays')).then(f => { if (f) setPlays(cur => ({ ...f, ...cur })) }).catch(() => {}) }, [])
  // 发音计数：每次播放这个词的发音 +1（正常/慢速/连读都算）
  const countPlay = useCallback((id: string) => {
    const n = { ...playsRef.current, [id]: (playsRef.current[id] ?? 0) + 1 }
    playsRef.current = n; setPlays(n); void put('meta', n, 'plays'); bumpDaily('plays')
  }, [bumpDaily])
  // 例句发音计数（自动朗读和点小喇叭都算），和单词发音分开统计
  const countExPlay = useCallback((id: string) => {
    const n = { ...exRef.current, [id]: (exRef.current[id] ?? 0) + 1 }
    exRef.current = n; setExPlays(n); void put('meta', n, 'exPlays'); bumpDaily('ex')
  }, [bumpDaily])
  useEffect(() => { db().then(async d => { const [e, dl] = await Promise.all([d.get('meta', 'exPlays'), d.get('meta', 'daily')]); if (e) setExPlays(cur => ({ ...e, ...cur })); if (dl) setDaily(cur => ({ ...dl, ...cur })) }).catch(() => {}) }, [])
  useEffect(() => { db().then(d => d.get('meta', 'flips')).then(f => { if (f) setFlips(cur => ({ ...f, ...cur })) }).catch(() => {}) }, [])
  // 翻卡计数：每个词每翻到背面一次 +1，存在本机（meta/flips），备份时一起导出
  const countFlip = useCallback((id: string) => {
    const n = { ...flipsRef.current, [id]: (flipsRef.current[id] ?? 0) + 1 }
    flipsRef.current = n; setFlips(n); void put('meta', n, 'flips'); bumpDaily('flips')
  }, [bumpDaily])

  useEffect(() => {
    (async () => {
      try {
        const data = await loadAll()
        { const pk = (await (await db()).get('meta', 'parked')) as Record<string, string> | undefined; parkedRef.current = pk ?? {}; setParked(pk ?? {}) }
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
        const cur = sess.find(x => x.date === date)
        const ratedToday = data.logs.some(l => l.date === date)
        if (!cur || ((cur.ver ?? 1) < SESSION_VER && !ratedToday)) {
          // 没有今天的课程，或是旧规则生成且今天还没学过 → 按日历课程日重新生成
          const ns = buildSession({ words: ws, lessons: ls, progress: pg, settings: s, sessions: sess, skip: skipNow() })
          await put('sessions', ns); sess = [...sess.filter(x => x.date !== date), ns]
        } else if ((cur.ver ?? 1) < SESSION_VER) {
          const fixed = { ...cur, dayNo: calendarDay(s, date), ver: SESSION_VER }   // 今天已学过：保留词表，只校正第几天
          await put('sessions', fixed); sess = sess.map(x => x.date === date ? fixed : x)
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

  // 新词池变化（合并新课程/导入）后，把今天课程的新词补足到每日新词数
  useEffect(() => {
    if (!ready) return
    const cur = sessions.find(x => x.date === todayStr); if (!cur) return
    const up = topUpSession(cur, { words, lessons, progress, settings, skip: parkedSet })
    if (up !== cur) { setSessions(ss => ss.map(x => x.date === up.date ? up : x)); put('sessions', up) }
  }, [ready, todayStr, words, lessons, progress, sessions, settings, parkedSet])

  // 跨天：回到应用/应用保持打开过了零点 → 更新日期，并自动生成新一天的课程（漏掉的日子在「学习记录」里可见）
  useEffect(() => {
    const tick = () => setTodayStr(today())
    document.addEventListener('visibilitychange', tick); window.addEventListener('focus', tick)
    const t = setInterval(tick, 60000)
    return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); clearInterval(t) }
  }, [])
  useEffect(() => {
    if (!ready) return
    const c = ref.current
    if (c.sessions.some(x => x.date === todayStr)) return
    const ns = buildSession({ words: c.words, lessons: c.lessons, progress: c.progress, settings: c.settings, sessions: c.sessions, date: todayStr, skip: skipNow() })
    setSessions(ss => ss.some(x => x.date === todayStr) ? ss : [...ss, ns]); put('sessions', ns)
  }, [ready, todayStr, sessions])

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

  const parkWord = useCallback((id: string, days = 60) => {
    const n = { ...parkedRef.current, [id]: addDays(today(), days) }
    parkedRef.current = n; setParked(n); void put('meta', n, 'parked')
    // 今天的任务里去掉它（新词位会由 topUp 自动补上别的词）
    const cur = ref.current.sessions.find(x => x.date === today())
    if (cur) {
      const up = { ...cur, newIds: cur.newIds.filter(i => i !== id), reviewIds: cur.reviewIds.filter(i => i !== id), wordIds: cur.wordIds.filter(i => i !== id) }
      setSessions(ss => ss.map(x => x.date === up.date ? up : x)); void put('sessions', up)
    }
  }, [])
  const unparkWord = useCallback((id: string) => {
    const n = { ...parkedRef.current }; delete n[id]
    parkedRef.current = n; setParked(n); void put('meta', n, 'parked')
  }, [])

  const exportBackup = useCallback((): Backup => {
    const c = ref.current
    return { app: 'thai30', version: 1, exportedAt: Date.now(), words: c.words, lessons: c.lessons, progress: [...c.progress.values()], logs: c.logs, sessions: c.sessions, settings: c.settings, flips: flipsRef.current, plays: playsRef.current, exPlays: exRef.current, daily: dailyRef.current, parked: parkedRef.current }
  }, [])

  const restoreBackup = useCallback(async (b: Backup, mode: 'replace' | 'merge') => {
    const c = ref.current
    if (b.parked) { const f = mode === 'replace' ? { ...b.parked } : { ...parkedRef.current, ...b.parked }; parkedRef.current = f; setParked(f); await put('meta', f, 'parked') }
    if (b.exPlays) {
      const f: Record<string, number> = mode === 'replace' ? { ...b.exPlays } : { ...exRef.current }
      if (mode !== 'replace') for (const [k, v] of Object.entries(b.exPlays)) f[k] = Math.max(f[k] ?? 0, v)
      exRef.current = f; setExPlays(f); await put('meta', f, 'exPlays')
    }
    if (b.daily) {
      const f: Record<string, DailyCount> = mode === 'replace' ? { ...b.daily } : { ...dailyRef.current }
      if (mode !== 'replace') for (const [k, v] of Object.entries(b.daily)) { const c = f[k]; f[k] = c ? { flips: Math.max(c.flips, v.flips), plays: Math.max(c.plays, v.plays), ex: Math.max(c.ex, v.ex) } : v }
      dailyRef.current = f; setDaily(f); await put('meta', f, 'daily')
    }
    if (b.plays) {
      const f: Record<string, number> = mode === 'replace' ? { ...b.plays } : { ...playsRef.current }
      if (mode !== 'replace') for (const [k, v] of Object.entries(b.plays)) f[k] = Math.max(f[k] ?? 0, v)
      playsRef.current = f; setPlays(f); await put('meta', f, 'plays')
    }
    if (b.flips) {
      const f: Record<string, number> = mode === 'replace' ? { ...b.flips } : { ...flipsRef.current }
      if (mode !== 'replace') for (const [k, v] of Object.entries(b.flips)) f[k] = Math.max(f[k] ?? 0, v)
      flipsRef.current = f; setFlips(f); await put('meta', f, 'flips')
    }
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
    const ns = buildSession({ words: c.words, lessons: c.lessons, progress: c.progress, settings: c.settings, sessions: c.sessions, skip: skipNow() })
    await put('sessions', ns); setSessions(s => [...s.filter(x => x.date !== ns.date), ns])
  }, [])

  // 调高「复习上限」后：只往今天的复习名单里补充到期词，已有的复习词和今天的新词一律不动
  const growReviews = useCallback(async (cap: number) => {
    const c = ref.current
    const cur = c.sessions.find(x => x.date === today()); if (!cur) return
    const have = new Set(cur.wordIds)
    const more = dueWords(c.progress, undefined, 4, skipNow()).map(p => p.wordId).filter(id => !have.has(id)).slice(0, Math.max(0, cap - cur.reviewIds.length))
    if (!more.length) return
    const ns = { ...cur, reviewIds: [...cur.reviewIds, ...more], wordIds: [...cur.wordIds, ...more] }
    await put('sessions', ns); setSessions(ss => ss.map(x => x.date === ns.date ? ns : x))
  }, [])

  const wordMap = useMemo(() => new Map(words.map(w => [w.id, w])), [words])
  const session = sessions.find(s => s.date === todayStr) ?? null
  const value: Ctx = { ready, error, words, wordMap, lessons, progress, logs, sessions, settings, session, flips, countFlip, plays, countPlay, exPlays, countExPlay, daily, parked, parkedSet, parkWord, unparkWord, rate, updateSettings, addWords, updateWord, exportBackup, restoreBackup, mergeLibrary, rebuildSession, growReviews }
  return <C.Provider value={value}>{children}</C.Provider>
}
export { wordIdFor }
