import { useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS } from '../types'
import { calendarDay } from '../lib/srs'
import { today } from '../lib/dates'
import { Sheet } from '../ui'

/** 选择第几天 → 学习整天 / 只学没学过的 / 只复习学过的。三种都会进入学习界面。 */
export default function DayPicker({ onClose, onStudy }: { onClose: () => void; onStudy: (title: string, ids: string[]) => void }) {
  const { lessons, progress, settings } = useApp()
  const [day, setDay] = useState<number | null>(null)
  const todayNo = calendarDay(settings, today())
  const sorted = [...lessons].sort((a, b) => a.day - b.day)
  const cur = day !== null ? sorted.find(l => l.day === day) : null

  if (cur) {
    const lv = (id: string) => progress.get(id)?.level ?? 0
    const all = cur.wordIds
    const fresh = all.filter(id => lv(id) === 0)
    const learned = all.filter(id => lv(id) > 0).sort((a, b) => lv(a) - lv(b))   // 陌生、不熟悉排前面
    const go = (title: string, ids: string[]) => { onClose(); onStudy(title, ids) }
    return (
      <Sheet onClose={onClose}>
        <button className="chip" onClick={() => setDay(null)}>‹ 选择其他天</button>
        <h2 style={{ marginTop: 12 }}>第 {cur.day} 天 · {all.length} 个词</h2>
        <p className="sub">已学过 {learned.length} 个 · 还没学 {fresh.length} 个</p>
        <button className="btn block" onClick={() => go(`第${cur.day}天 · 全部`, all)} data-testid="day-all">学习这天全部 {all.length} 个词</button>
        <button className="btn sec block" disabled={!fresh.length} onClick={() => go(`第${cur.day}天 · 新词`, fresh)} data-testid="day-fresh">只学还没学过的（{fresh.length}）</button>
        <button className="btn sec block" disabled={!learned.length} onClick={() => go(`第${cur.day}天 · 复习`, learned)} data-testid="day-review">只复习学过的（{learned.length}）· 生疏的在前</button>
      </Sheet>
    )
  }
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>选择天数</h2>
      <p className="sub">点某一天，进入那一天的词学习或复习。今天是第 {todayNo} 天。</p>
      {sorted.map(l => {
        const c = [0, 0, 0, 0, 0]; l.wordIds.forEach(id => c[progress.get(id)?.level ?? 0]++)
        return (
          <button key={l.day} className="row" onClick={() => setDay(l.day)} data-testid={'pick-' + l.day}>
            <span className="pill" style={{ background: l.day === todayNo ? 'var(--blue)' : '#8e95a5', minWidth: 52, textAlign: 'center' }}>第{l.day}天</span>
            <span className="m"><div className="bar">{[4, 3, 2, 1, 0].map(k => <i key={k} style={{ width: `${(c[k] / l.wordIds.length) * 100}%`, background: LEVEL_COLORS[k] }} />)}</div>
              <div className="sub" style={{ marginTop: 4 }}>{l.wordIds.length} 词{l.day === todayNo ? ' · 今天' : ''}{c[0] ? ` · 未学 ${c[0]}` : ' · 已全部学过'}</div></span>
          </button>)
      })}
    </Sheet>
  )
}
