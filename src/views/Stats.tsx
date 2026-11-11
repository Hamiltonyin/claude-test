import { useMemo } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES } from '../types'
import { addDays, today } from '../lib/dates'
import { StatsHeader, streakOf } from './Home'
import Records from './Records'

export default function Stats({ onCatchup }: { onCatchup: (title: string, ids: string[]) => void }) {
  const { logs, words, progress, settings, daily } = useApp()
  const days = useMemo(() => {
    const t = today(); const out: { d: string; n: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = addDays(t, -i)
      out.push({ d, n: new Set(logs.filter(l => l.date === d).map(l => l.wordId)).size })
    }
    return out
  }, [logs])
  // 每日学习量：评级的不同词数、其中新词、翻卡次数、单词/例句发音次数
  const rows = useMemo(() => {
    const t = today(); const out = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(t, -i), ls = logs.filter(l => l.date === d), c = daily[d]
      out.push({ d, rated: new Set(ls.map(l => l.wordId)).size, fresh: new Set(ls.filter(l => l.prev === 0).map(l => l.wordId)).size, flips: c?.flips ?? 0, plays: c?.plays ?? 0, ex: c?.ex ?? 0 })
    }
    return out
  }, [logs, daily])
  const counts = [0, 0, 0, 0, 0]; words.forEach(w => counts[progress.get(w.id)?.level ?? 0]++)
  const max = Math.max(settings.dailyGoal, ...days.map(d => d.n))
  const todayN = days[days.length - 1].n
  const active = days.filter(d => d.n > 0)
  const avg = active.length ? Math.round(active.reduce((a, b) => a + Math.min(1, b.n / settings.dailyGoal), 0) / active.length * 100) : 0
  const tomorrow = [...progress.values()].filter(p => p.level > 0 && (p.due ?? '') <= addDays(today(), 1)).length
  return (
    <>
      <h1>学习统计</h1>
      <StatsHeader />
      <div className="panel"><h3>今日完成率</h3>
        <div style={{ fontSize: 34, fontWeight: 700, margin: '6px 0' }}>{Math.round(Math.min(1, todayN / settings.dailyGoal) * 100)}%</div>
        <div className="bar"><i style={{ width: `${Math.min(100, (todayN / settings.dailyGoal) * 100)}%`, background: 'var(--blue)' }} /></div>
        <p className="sub">近 14 天有学习的日子平均完成率 {avg}% · 连续 {streakOf(logs)} 天 · 明天前到期 {tomorrow} 词</p></div>
      <div className="panel" data-testid="daily-panel"><h3>每日学习量</h3>
        <div className="dgrid today">
          {([['评级词数', rows[0].rated], ['新词', rows[0].fresh], ['翻卡', rows[0].flips], ['听单词', rows[0].plays], ['听例句', rows[0].ex]] as [string, number][]).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
        </div>
        <p className="sub" style={{ margin: '6px 0' }}>今天 · 下面是最近 7 天</p>
        <table className="dtable"><thead><tr><th>日期</th><th>评级</th><th>新词</th><th>翻卡</th><th>听词</th><th>听句</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.d} className={r.rated + r.flips + r.plays + r.ex ? '' : 'zero'}><td>{r.d.slice(5)}</td><td>{r.rated}</td><td>{r.fresh}</td><td>{r.flips}</td><td>{r.plays}</td><td>{r.ex}</td></tr>)}</tbody></table>
      </div>
      <div className="panel"><h3>近 14 天（每天评级的不同词数）</h3>
        <div className="chart">{days.map(d => <div key={d.d}><span>{d.n || ''}</span><i style={{ height: `${(d.n / max) * 80}%`, background: d.n >= settings.dailyGoal ? 'var(--green)' : 'var(--blue)' }} /></div>)}</div>
        <div className="chart" style={{ height: 'auto', marginTop: 2 }}>{days.map(d => <div key={d.d} style={{ height: 'auto' }}>{d.d.slice(8)}</div>)}</div>
      </div>
      <h2>每日学习记录</h2>
      <Records limit={60} onCatchup={onCatchup} />
      <div className="panel" style={{ marginTop: 16 }}><h3>熟练度数量</h3>
        {[4, 3, 2, 1, 0].map(l => <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
          <span style={{ width: 54, fontSize: 14 }}>{LEVEL_NAMES[l]}</span>
          <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(counts[l] / Math.max(1, words.length)) * 100}%`, background: LEVEL_COLORS[l] }} /></div>
          <b style={{ width: 28, textAlign: 'right' }}>{counts[l]}</b></div>)}
      </div>
    </>
  )
}
