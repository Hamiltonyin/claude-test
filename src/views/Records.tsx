import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { dayRecords, missedDays, type DayRecord, type DayStatus } from '../lib/records'
import { Sheet } from '../ui'

export const STATUS_TEXT: Record<DayStatus, string> = { done: '已完成', partial: '只学了一部分', missed: '漏学', today: '今天', none: '无新词' }
export const STATUS_COLOR: Record<DayStatus, string> = { done: 'var(--green)', partial: 'var(--orange)', missed: 'var(--red)', today: 'var(--blue)', none: '#c7ccd6' }
const mmdd = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`

function Detail({ r, onClose, onCatchup }: { r: DayRecord; onClose: () => void; onCatchup: (title: string, ids: string[]) => void }) {
  const { wordMap } = useApp()
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{r.date} · 第 {r.dayNo} 天</h2>
      <p><span className="pill" style={{ background: STATUS_COLOR[r.status] }}>{STATUS_TEXT[r.status]}</span>{!r.hasSession && r.status !== 'none' && <span className="sub"> 这天没有打开应用</span>}</p>
      <div className="panel">
        <div>新词：<b>{r.newDone}/{r.newIds.length}</b></div>
        <div>复习：<b>{r.reviewDone}/{r.reviewIds.length}</b>{!r.hasSession && <span className="sub">（当天没有生成复习）</span>}</div>
      </div>
      {r.missedIds.length > 0 && <>
        <h3>这天还没学的词（{r.missedIds.length}）</h3>
        <div className="chips" style={{ margin: '8px 0' }}>
          {r.missedIds.slice(0, 40).map(id => { const w = wordMap.get(id); return w ? <span key={id} className="chip th" lang="th">{w.thai}<small>{w.zh.split('；')[0]}</small></span> : null })}
        </div>
        <button className="btn block" onClick={() => { onClose(); onCatchup(`补学 ${mmdd(r.date)}`, r.missedIds.slice(0, 30)) }} data-testid="catchup-day">补学这天的 {Math.min(30, r.missedIds.length)} 个词</button>
      </>}
    </Sheet>
  )
}

/** 每日学习记录。compact=首页最近 N 天横条；否则为完整列表 */
export default function Records({ limit, onCatchup, compact }: { limit: number; onCatchup: (title: string, ids: string[]) => void; compact?: boolean }) {
  const { settings, sessions, lessons, logs, progress } = useApp()
  const [open, setOpen] = useState<DayRecord | null>(null)
  const all = useMemo(() => dayRecords({ settings, sessions, lessons, logs, progress }), [settings, sessions, lessons, logs, progress])
  const list = all.slice(-limit).reverse()
  return (
    <>
      {!compact && <p className="sub">共 {all.length} 天，漏学 {missedDays(all)} 天。点某一天查看详情或补学。</p>}
      <div className={compact ? 'rec-strip' : 'rec-list'} data-testid="records">
        {list.map(r => (
          <button key={r.date} className={'rec' + (compact ? ' c' : '')} onClick={() => setOpen(r)} data-testid={'rec-' + r.status}>
            <span className="dot" style={{ background: STATUS_COLOR[r.status] }} />
            <span className="rd">{mmdd(r.date)}<small>第{r.dayNo}天</small></span>
            {compact ? <span className="rs" style={{ color: STATUS_COLOR[r.status] }}>{STATUS_TEXT[r.status].slice(0, 3)}</span>
              : <span className="rs2"><b style={{ color: STATUS_COLOR[r.status] }}>{STATUS_TEXT[r.status]}</b> · 新词 {r.newDone}/{r.newIds.length} · 复习 {r.reviewDone}/{r.reviewIds.length}</span>}
          </button>
        ))}
      </div>
      {open && <Detail r={open} onClose={() => setOpen(null)} onCatchup={onCatchup} />}
    </>
  )
}
