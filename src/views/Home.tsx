import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES } from '../types'
import { today, addDays } from '../lib/dates'
import { dueWords, weakWords, myAddedIds } from '../lib/srs'
import { THEMES } from '../data/seed'
import { Burst, Chev } from '../ui'
import { db, put } from '../lib/db'
import { evaluate, newlyUnlocked, type BadgeState } from '../lib/achievements'
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
      <div className="stat"><b>{h.doneToday}/{h.newTotal}</b><span>今日新词</span></div>
      <div className="stat"><b>{h.total}</b><span>总词汇</span></div>
      <div className="stat"><b>{h.streak}天</b><span>连续学习</span></div>
    </div>
  )
}

/** 数字从 0 滚动到目标值 */
function useCountUp(to: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return v
}

/** 今日进度环：从 0 转到当前进度 */
function Ring({ pct, done, total }: { pct: number; done: number; total: number }) {
  const [p, setP] = useState(0)
  useEffect(() => { const t = setTimeout(() => setP(pct), 80); return () => clearTimeout(t) }, [pct])
  const R = 46, C = 2 * Math.PI * R
  const n = useCountUp(done)
  return (
    <div className="ring" data-testid="ring">
      <svg viewBox="0 0 110 110"><circle cx="55" cy="55" r={R} className="rbg" /><circle cx="55" cy="55" r={R} className="rfg" strokeDasharray={C} strokeDashoffset={C * (1 - p)} /></svg>
      <div className="rtxt"><b>{n}</b><span>/ {total}</span></div>
    </div>
  )
}

function UnlockModal({ list, onClose }: { list: BadgeState[]; onClose: () => void }) {
  return (
    <div className="unlock" onClick={onClose} data-testid="unlock">
      <div className="ucard" onClick={e => e.stopPropagation()}>
        <div className="uhead">🎉 解锁新成就</div>
        <div className="ubadges">{list.map(b => <div key={b.id} className="ub"><i>{b.emoji}</i><b>{b.title}</b><span>{b.desc}</span></div>)}</div>
        <button className="btn block" onClick={onClose}>太棒了，继续</button>
      </div>
      <Burst k={1} big />
    </div>
  )
}

export default function Home({ onStudy, onLibrary, onTheme, onCatchup, onMoreRecords, onPickDay, onMine, onPractice, onSearch, onDialogues, onVowels }: { onStudy: (m: 'today' | 'review' | 'weak') => void; onLibrary: () => void; onTheme: (t: string) => void; onCatchup: (title: string, ids: string[]) => void; onMoreRecords: () => void; onPickDay: () => void; onMine: () => void; onPractice: (k: 'verify' | 'master') => void; onSearch: (q: string) => void; onDialogues: () => void; onVowels: () => void }) {
  const [hq, setHq] = useState('')
  const { progress, words, settings, sessions, lessons, logs, session, flips, plays, exPlays, daily, parkedSet } = useApp()
  const mineN = useMemo(() => myAddedIds(lessons).length, [lessons])
  const due = dueWords(progress, undefined, 4, parkedSet).length
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0]
    for (const w of words) c[progress.get(w.id)?.level ?? 0]++
    return c
  }, [words, progress])
  const themeCount = useMemo(() => { const m = new Map<string, number>(); words.forEach(w => m.set(w.theme, (m.get(w.theme) ?? 0) + 1)); return m }, [words])
  const h = useHeaderStats()
  const records = useMemo(() => dayRecords({ settings, sessions, lessons, logs, progress }), [settings, sessions, lessons, logs, progress])
  const backlog = useMemo(() => backlogIds(records, new Set(session?.newIds ?? [])), [records, session])
  const missed = missedDays(records)
  const overdue = (session?.reviewIds ?? []).filter(id => (progress.get(id)?.due ?? '9999') < today()).length
  const newLeft = h.newTotal - h.doneToday
  const revLeft = h.reviewTotal - h.reviewDone
  const weak = counts[1] + counts[2]

  // —— 今日成就感 ——
  const date = today()
  const target = h.newTotal + h.reviewTotal || settings.dailyGoal
  const doneN = h.doneToday + h.reviewDone
  const pct = Math.min(1, doneN / Math.max(1, target))
  const c = daily[date]
  const masteredToday = useMemo(() => new Set(logs.filter(l => l.date === date && l.level >= 3 && l.prev < 3).map(l => l.wordId)).size, [logs, date])
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  const ach = useMemo(() => evaluate({ streak: h.streak, learned: counts[1] + counts[2] + counts[3] + counts[4], mastered: counts[3] + counts[4], perfect: counts[4], flips: sum(flips), listens: sum(plays) + sum(exPlays), reviews: logs.length }), [h.streak, counts, flips, plays, exPlays, logs.length])
  const headline = pct >= 1 ? '今日任务全部完成！' : pct === 0 ? '开始今天的第一个词吧' : pct < 0.5 ? '状态来了，继续保持' : '过半啦，再加把劲'
  const cta = newLeft > 0 ? { t: `开始学习新词 · 还剩 ${newLeft}`, m: 'today' as const } : revLeft > 0 ? { t: `开始今日复习 · 还剩 ${revLeft}`, m: 'review' as const } : { t: '🎉 今日已完成 · 再练练弱项', m: 'weak' as const }
  const [doneBurst, setDoneBurst] = useState(0)
  useEffect(() => {   // 当天第一次达成 100%：撒一次彩纸
    if (pct < 1 || h.newTotal + h.reviewTotal === 0) return
    try { const k = 'thai30-done-' + date; if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { /* 无痕模式：每次打开都庆祝也无妨 */ }
    setDoneBurst(1)
  }, [pct, date, h.newTotal, h.reviewTotal])
  // 新成就解锁：弹窗庆祝一次（之后只庆祝新的）
  const [unlock, setUnlock] = useState<BadgeState[]>([])
  const checked = useRef(false)
  useEffect(() => {
    if (checked.current || !words.length) return
    checked.current = true
    db().then(async d => {
      const seen = new Set<string>((await d.get('meta', 'badges')) ?? [])
      const fresh = newlyUnlocked(ach.earned, seen)
      await put('meta', ach.earned.map(b => b.id), 'badges')
      if (fresh.length && !(navigator as any).webdriver) setUnlock(fresh)   // 自动化测试浏览器里不弹，免得挡住点击
    }).catch(() => {})
  }, [ach, words.length])
  const [showAll, setShowAll] = useState(false)
  const wall = [...ach.earned, ...ach.next]
  const wallShown = showAll ? wall : wall.slice(0, 8)

  return (
    <>
      <div className="hhead">
        <div><h1>泰语每日30词</h1><span className="daypill">第 {h.dayNo} 天</span></div>
        <div className="flame" data-testid="streak">🔥 <b>{h.streak}</b> 天</div>
      </div>
      <form className="homesearch" onSubmit={e => { e.preventDefault(); if (hq.trim()) onSearch(hq.trim()) }}>
        <input value={hq} onChange={e => setHq(e.target.value)} placeholder="🔍 中文查单词：请、帮忙、怎么、如果" data-testid="home-search" enterKeyHint="search" />
        <button type="submit" data-testid="home-search-go">查</button>
      </form>

      <section className="hero">
        <div className="herotop">
          <Ring pct={pct} done={doneN} total={target} />
          <div className="herotxt">
            <div className="hl">{headline}</div>
            <div className="hs">今日已完成 {Math.round(pct * 100)}%</div>
            <div className="hmini">
              <span><b>+{masteredToday}</b>今日掌握</span>
              <span><b>{c?.flips ?? 0}</b>翻卡</span>
              <span><b>{(c?.plays ?? 0) + (c?.ex ?? 0)}</b>听读</span>
            </div>
          </div>
        </div>
        <button className="herocta" onClick={() => onStudy(cta.m)} data-testid="hero-cta">{cta.t}</button>
        <p className="todayline" data-testid="today-line">今天：评级 {doneN} 词 · 翻卡 {c?.flips ?? 0} 次 · 听单词 {c?.plays ?? 0} 次 · 听例句 {c?.ex ?? 0} 次</p>
      </section>

      <div className="sech"><h2>今日任务</h2></div>
      <div className="tasks">
        <button className="task" onClick={() => onStudy('today')} data-testid="start-today">
          <div className="tt"><i style={{ background: 'var(--blue)' }}>📖</i>新词</div>
          <div className="tn"><b>{h.doneToday}</b>/{h.newTotal}</div>
          <div className="bar"><i style={{ width: `${h.newTotal ? (h.doneToday / h.newTotal) * 100 : 0}%`, background: 'var(--blue)' }} /></div>
          <div className="td">{h.newTotal === 0 ? '新词已学完' : newLeft === 0 ? `新词 ${h.newTotal} 个 · 已完成 ✓` : `新词 ${h.newTotal} 个 · 还剩 ${newLeft} 个`}</div>
        </button>
        <button className="task" onClick={() => onStudy('review')} data-testid="start-review">
          <div className="tt"><i style={{ background: '#af52de' }}>🔁</i>复习</div>
          <div className="tn"><b>{h.reviewDone}</b>/{h.reviewTotal}</div>
          <div className="bar"><i style={{ width: `${h.reviewTotal ? (h.reviewDone / h.reviewTotal) * 100 : 0}%`, background: '#af52de' }} /></div>
          <div className="td">{h.reviewTotal === 0 ? '学过的词到期后会出现在这里' : revLeft === 0 ? `到期复习 ${h.reviewTotal} 个 · 已完成 ✓` : `到期复习 ${h.reviewTotal} 个 · 还剩 ${revLeft} 个${overdue ? ` · 逾期 ${overdue}` : ''}`}</div>
        </button>
      </div>

      <div className="sech"><h2>升级通道</h2><span>把词升一级，赚成就</span></div>
      <div className="tasks">
        <button className="task up" onClick={() => onPractice('verify')} data-testid="start-verify">
          <div className="tt"><i style={{ background: '#007aff' }}>✅</i>验收 → 熟悉</div>
          <div className="tn"><b>{weak}</b><small> 个待验收</small></div>
          <div className="td">{weak ? `陌生 ${counts[1]} + 不熟悉 ${counts[2]} · 听音/选词，答对升一级` : '没有需要验收的词'}</div>
        </button>
        <button className="task up" onClick={() => onPractice('master')} data-testid="start-master">
          <div className="tt"><i style={{ background: '#34c759' }}>🌟</i>举一反三</div>
          <div className="tn"><b>{counts[3]}</b><small> 个可挑战</small></div>
          <div className="td">{counts[3] ? `熟悉 ${counts[3]} 个 · 例句填空/听音，全对才升精通` : '先把词学到「熟悉」再来'}</div>
        </button>
      </div>

      <div className="sech"><h2>我的成就</h2><span>已解锁 {ach.earned.length}/{ach.all.length}</span></div>
      <section className="panel ach" data-testid="achievements">
        <div className="mastery">
          <div className="mtop"><b>{counts[3] + counts[4]}</b><span> / {words.length} 词已掌握</span></div>
          <div className="bar">{[4, 3, 2, 1, 0].map(l => <i key={l} style={{ width: `${(counts[l] / Math.max(1, words.length)) * 100}%`, background: LEVEL_COLORS[l] }} />)}</div>
          <div className="mleg">{[4, 3, 2, 1, 0].map(l => <span key={l}><i style={{ background: LEVEL_COLORS[l] }} />{LEVEL_NAMES[l]} {counts[l]}</span>)}</div>
        </div>
        {ach.nearest && (
          <div className="nextgoal">
            <span className="ng-e">{ach.nearest.emoji}</span>
            <div><div className="ng-t">下一个成就：{ach.nearest.title}</div><div className="bar"><i style={{ width: `${Math.min(100, (ach.nearest.cur / ach.nearest.need) * 100)}%`, background: 'var(--orange)' }} /></div>
              <div className="ng-d">{ach.nearest.cur} / {ach.nearest.need} · 还差 {ach.nearest.need - ach.nearest.cur}</div></div>
          </div>
        )}
        <div className="wall">
          {wallShown.map(b => <div key={b.id} className={'badge' + (b.earned ? ' on' : '')} title={b.desc}><i>{b.emoji}</i><span>{b.title}</span></div>)}
        </div>
        {wall.length > 8 && <button className="more" onClick={() => setShowAll(v => !v)}>{showAll ? '收起' : `展开全部 ${wall.length} 个`}</button>}
      </section>

      <div className="sech"><h2>更多学习方式</h2></div>
      <div className="minis">
        <button className="mini" onClick={() => onStudy('weak')} data-testid="start-weak"><i style={{ background: 'var(--orange)' }}>🎧</i><b>重点复习</b><span>陌生 {counts[1]} · 不熟悉 {counts[2]}</span></button>
        <button className="mini" onClick={onPickDay} data-testid="pick-day"><i style={{ background: '#5856d6' }}>📅</i><b>选择天数</b><span>共 {lessons.length} 天可选</span></button>
        <button className="mini" onClick={onMine} data-testid="open-mine"><i style={{ background: '#ff6482' }}>📝</i><b>我录入的词</b><span>{mineN ? `共 ${mineN} 个` : '还没有'}</span></button>
        <button className="mini" onClick={onDialogues} data-testid="open-dialogues"><i style={{ background: '#0a84ff' }}>💬</i><b>情景对话</b><span>一句一句学整段对话</span></button>
        <button className="mini" onClick={onVowels} data-testid="open-vowels"><i style={{ background: '#ff9f0a' }}>🔤</i><b>元音发音</b><span>32 个元音 · 配老师视频</span></button>
        <button className="mini" onClick={onLibrary} data-testid="open-library"><i style={{ background: 'var(--green)' }}>🗂</i><b>全部词库</b><span>{words.length} 词 · 今日到期 {due}</span></button>
        {backlog.length > 0 && (
          <button className="mini alert" onClick={() => onCatchup('漏学补学', backlog.slice(0, 30))} data-testid="start-catchup"><i style={{ background: 'var(--red)' }}>⏰</i><b>漏学补学</b><span>{backlog.length} 个没学 · 漏学 {missed} 天</span></button>
        )}
      </div>

      <div className="sech"><h2>学习记录</h2><button className="sub" style={{ fontSize: 13, color: 'var(--blue)' }} onClick={onMoreRecords}>全部 ›</button></div>
      <Records limit={7} compact onCatchup={onCatchup} />
      <div className="sech"><h2>按主题学习</h2></div>
      <div className="chips">
        {THEMES.map(t => <button key={t} className="chip" disabled={!themeCount.get(t)} style={!themeCount.get(t) ? { opacity: .45 } : undefined} onClick={() => onTheme(t)}>{t}<small>{themeCount.get(t) ?? 0}</small></button>)}
      </div>
      {unlock.length > 0 && <UnlockModal list={unlock} onClose={() => setUnlock([])} />}
      <Burst k={doneBurst} big />
    </>
  )
}
