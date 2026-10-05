import { useMemo } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES } from '../types'
import { today, addDays } from '../lib/dates'
import { dueWords, weakWords } from '../lib/srs'
import { THEMES } from '../data/seed'
import { Chev } from '../ui'

export function streakOf(logs: { date: string }[]): number {
  const days = new Set(logs.map(l => l.date))
  let d = today(), n = 0
  if (!days.has(d)) d = addDays(d, -1)
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return n
}

export function useHeaderStats() {
  const { logs, words, session } = useApp()
  const date = today()
  const ratedToday = new Set(logs.filter(l => l.date === date).map(l => l.wordId))
  const newIds = session?.newIds ?? []
  const doneToday = newIds.filter(i => ratedToday.has(i)).length   // 今日新词完成数
  const reviewIds = session?.reviewIds ?? []
  const reviewDone = reviewIds.filter(i => ratedToday.has(i)).length
  return { doneToday, newTotal: newIds.length, reviewDone, reviewTotal: reviewIds.length, total: words.length, streak: streakOf(logs), dayNo: session?.dayNo ?? 1 }
}

export function StatsHeader() {
  const h = useHeaderStats()
  return (
    <div className="stats">
      <div className="stat"><b>第{h.dayNo}天</b><span>今日课程</span></div>
      <div className="stat"><b>{h.doneToday}/{h.newTotal}</b><span>今日新词</span></div>
      <div className="stat"><b>{h.total}</b><span>总词汇</span></div>
      <div className="stat"><b>{h.streak}天</b><span>连续学习</span></div>
    </div>
  )
}

export default function Home({ onStudy, onLibrary, onTheme }: { onStudy: (m: 'today' | 'review' | 'weak') => void; onLibrary: () => void; onTheme: (t: string) => void }) {
  const { progress, words, settings } = useApp()
  const weak = weakWords(progress).length
  const due = dueWords(progress).length
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0]
    for (const w of words) c[progress.get(w.id)?.level ?? 0]++
    return c
  }, [words, progress])
  const themeCount = useMemo(() => { const m = new Map<string, number>(); words.forEach(w => m.set(w.theme, (m.get(w.theme) ?? 0) + 1)); return m }, [words])
  const h = useHeaderStats()
  const newLeft = h.newTotal - h.doneToday
  const revLeft = h.reviewTotal - h.reviewDone
  return (
    <>
      <h1>泰语每日30词</h1>
      <StatsHeader />
      <button className="entry" onClick={() => onStudy('today')} data-testid="start-today">
        <div className="ic" style={{ background: 'var(--blue)' }}>📖</div>
        <div><div className="t">今天学习 · 新词</div>
          <div className="d">{h.newTotal === 0 ? '新词已学完，请添加新课程' : newLeft === 0 ? `今日 ${h.newTotal} 个新词已完成，可再看一遍` : `新词 ${h.newTotal} 个 · 还剩 ${newLeft} 个`}</div></div><Chev />
      </button>
      <button className="entry" onClick={() => onStudy('review')} data-testid="start-review">
        <div className="ic" style={{ background: '#af52de' }}>🔁</div>
        <div><div className="t">今日复习</div>
          <div className="d">{h.reviewTotal === 0 ? '今天没有到期的复习词' : revLeft === 0 ? `到期复习 ${h.reviewTotal} 个已完成` : `到期复习 ${h.reviewTotal} 个 · 还剩 ${revLeft} 个`}</div></div><Chev />
      </button>
      <button className="entry" onClick={() => onStudy('weak')} data-testid="start-weak">
        <div className="ic" style={{ background: 'var(--orange)' }}>🎧</div>
        <div><div className="t">重点复习 · 听音跟读</div><div className="d">陌生 {counts[1]} + 不熟悉 {counts[2]} · 今日到期 {due}</div></div><Chev />
      </button>
      <button className="entry" onClick={onLibrary} data-testid="open-library">
        <div className="ic" style={{ background: 'var(--green)' }}>🗂</div>
        <div><div className="t">全部词库</div><div className="d">{words.length} / 500 词目标 · 搜索中文/泰文/拼音</div></div><Chev />
      </button>
      <h2>熟练度分布</h2>
      <div className="bar">{[4, 3, 2, 1, 0].map(l => <i key={l} style={{ width: `${(counts[l] / Math.max(1, words.length)) * 100}%`, background: LEVEL_COLORS[l] }} />)}</div>
      <div className="chips" style={{ marginTop: 10 }}>
        {[1, 2, 3, 4, 0].map(l => <span key={l} className="sub"><span className="dot" style={{ background: LEVEL_COLORS[l], display: 'inline-block', marginRight: 5 }} />{LEVEL_NAMES[l]} {counts[l]}</span>)}
      </div>
      <h2>按主题学习</h2>
      <div className="chips">
        {THEMES.map(t => <button key={t} className="chip" disabled={!themeCount.get(t)} style={!themeCount.get(t) ? { opacity: .45 } : undefined} onClick={() => onTheme(t)}>{t}<small>{themeCount.get(t) ?? 0}</small></button>)}
      </div>
      <p className="sub" style={{ marginTop: 18 }}>每天 {settings.newPerDay ?? 30} 个新词，外加到期的复习词（陌生与不熟悉优先，最多 {settings.reviewCap} 个）。</p>
    </>
  )
}
