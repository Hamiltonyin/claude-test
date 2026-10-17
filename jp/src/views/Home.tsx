import { useMemo } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES } from '../types'
import { today, addDays } from '../lib/dates'
import { dueWords, weakWords } from '../lib/srs'
import { Chev } from '../ui'
import Records from './Records'
import { backlogIds, dayRecords, missedDays } from '../lib/records'

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
      <div className="stat"><b>{h.doneToday}/{h.newTotal}</b><span>今日新卡</span></div>
      <div className="stat"><b>{h.total}</b><span>总卡片</span></div>
      <div className="stat"><b>{h.streak}天</b><span>连续学习</span></div>
    </div>
  )
}

export default function Home({ onStudy, onLibrary, onTheme, onCatchup, onMoreRecords }: { onStudy: (m: 'today' | 'review' | 'weak') => void; onLibrary: () => void; onTheme: (t: string) => void; onCatchup: (title: string, ids: string[]) => void; onMoreRecords: () => void }) {
  const { progress, words, settings, sessions, lessons, logs, session } = useApp()
  const weak = weakWords(progress).length
  const due = dueWords(progress).length
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0]
    for (const w of words) c[progress.get(w.id)?.level ?? 0]++
    return c
  }, [words, progress])
  const themeCount = useMemo(() => { const m = new Map<string, number>(); words.forEach(w => m.set(w.theme, (m.get(w.theme) ?? 0) + 1)); return m }, [words])
  const THEMES = useMemo(() => [...themeCount.keys()], [themeCount])
  const h = useHeaderStats()
  const records = useMemo(() => dayRecords({ settings, sessions, lessons, logs, progress }), [settings, sessions, lessons, logs, progress])
  const backlog = useMemo(() => backlogIds(records, new Set(session?.newIds ?? [])), [records, session])
  const missed = missedDays(records)
  const overdue = (session?.reviewIds ?? []).filter(id => (progress.get(id)?.due ?? '9999') < today()).length
  const newLeft = h.newTotal - h.doneToday
  const revLeft = h.reviewTotal - h.reviewDone
  return (
    <>
      <h1>职场日语 · 从假名开始</h1>
      <StatsHeader />
      <button className="entry" onClick={() => onStudy('today')} data-testid="start-today">
        <div className="ic" style={{ background: 'var(--blue)' }}>📖</div>
        <div><div className="t">今天学习 · 新卡片</div>
          <div className="d">{h.newTotal === 0 ? '新卡片已学完' : newLeft === 0 ? `今日 ${h.newTotal} 张新卡已完成，可再看一遍` : `新卡片 ${h.newTotal} 张 · 还剩 ${newLeft} 张`}</div></div><Chev />
      </button>
      <button className="entry" onClick={() => onStudy('review')} data-testid="start-review">
        <div className="ic" style={{ background: '#af52de' }}>🔁</div>
        <div><div className="t">今日复习</div>
          <div className="d">{h.reviewTotal === 0 ? '今天没有到期的复习卡' : revLeft === 0 ? `到期复习 ${h.reviewTotal} 张已完成` : `到期复习 ${h.reviewTotal} 张 · 还剩 ${revLeft} 张${overdue ? ` · 逾期 ${overdue} 张` : ''}`}</div></div><Chev />
      </button>
      {backlog.length > 0 && (
        <button className="entry" onClick={() => onCatchup('漏学补学', backlog.slice(0, 20))} data-testid="start-catchup">
          <div className="ic" style={{ background: 'var(--red)' }}>⏰</div>
          <div><div className="t">漏学补学</div>
            <div className="d">有 {backlog.length} 张新卡没学（漏学 {missed} 天）· 先补 {Math.min(20, backlog.length)} 张</div></div><Chev />
        </button>
      )}
      <button className="entry" onClick={() => onStudy('weak')} data-testid="start-weak">
        <div className="ic" style={{ background: 'var(--orange)' }}>🎧</div>
        <div><div className="t">重点复习 · 听音跟读</div><div className="d">陌生 {counts[1]} + 不熟悉 {counts[2]} · 今日到期 {due}</div></div><Chev />
      </button>
      <button className="entry" onClick={onLibrary} data-testid="open-library">
        <div className="ic" style={{ background: 'var(--green)' }}>🗂</div>
        <div><div className="t">卡片库</div><div className="d">{words.length} 张 · 搜索日文/假名/罗马音/中文</div></div><Chev />
      </button>
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>学习记录<button className="sub" style={{ fontSize: 13, color: 'var(--blue)' }} onClick={onMoreRecords}>全部 ›</button></h2>
      <Records limit={7} compact onCatchup={onCatchup} />
      <h2>熟练度分布</h2>
      <div className="bar">{[4, 3, 2, 1, 0].map(l => <i key={l} style={{ width: `${(counts[l] / Math.max(1, words.length)) * 100}%`, background: LEVEL_COLORS[l] }} />)}</div>
      <div className="chips" style={{ marginTop: 10 }}>
        {[1, 2, 3, 4, 0].map(l => <span key={l} className="sub"><span className="dot" style={{ background: LEVEL_COLORS[l], display: 'inline-block', marginRight: 5 }} />{LEVEL_NAMES[l]} {counts[l]}</span>)}
      </div>
      <h2>按主题学习</h2>
      <div className="chips">
        {THEMES.map(t => <button key={t} className="chip" disabled={!themeCount.get(t)} style={!themeCount.get(t) ? { opacity: .45 } : undefined} onClick={() => onTheme(t)}>{t}<small>{themeCount.get(t) ?? 0}</small></button>)}
      </div>
      <p className="sub" style={{ marginTop: 18 }}>每天学当天课程的新卡片（假名课 10~19 张），外加到期的复习卡（陌生与不熟悉优先，最多 {settings.reviewCap} 张）。</p>
    </>
  )
}
