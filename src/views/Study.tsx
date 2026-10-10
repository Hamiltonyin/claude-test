import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level } from '../types'
import { SpeakButtons, ToneChips, useSpeaker } from '../ui'
import { today } from '../lib/dates'

export type StudyMode = 'today' | 'review' | 'catchup' | 'weak' | 'theme' | 'day' | 'free'

export default function Study({ title, ids, mode, onClose }: { title: string; ids: string[]; mode: StudyMode; onClose: () => void }) {
  const { wordMap, progress, logs, rate, settings } = useApp()
  const sp = useSpeaker()
  const rated = useRef(new Set<string>())
  const requeued = useRef(new Map<string, number>())
  const [queue, setQueue] = useState<string[]>(ids)
  const [idx, setIdx] = useState(() => {
    if (mode !== 'today' && mode !== 'review') return 0
    const doneToday = new Set(logs.filter(l => l.date === today()).map(l => l.wordId))
    const first = ids.findIndex(i => !doneToday.has(i))
    return first < 0 ? 0 : first
  })
  const [flip, setFlip] = useState(false)
  const [finished, setFinished] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const id = queue[idx]
  const isRepeat = !!id && queue.indexOf(id) < idx          // 同一个词在本轮更早出现过 = 陌生词重现
  const uniqueTotal = useMemo(() => new Set(queue).size, [queue])
  const uniquePos = useMemo(() => new Set(queue.slice(0, idx + 1)).size, [queue, idx])
  const word = id ? wordMap.get(id) : undefined
  const level = (id && progress.get(id)?.level) || 0

  const go = (to: number) => {
    sp.stop(); setFlip(false)
    if (to >= queue.length) { setFinished(true); return }
    if (to < 0) return
    setIdx(to)
  }
  const toggle = () => {
    const nf = !flip; setFlip(nf)
    // 翻到背面时自动朗读（在点击回调里同步触发，iPhone 才允许）；可在「我的」里关闭
    if (nf && word && settings.autoPlay) sp.play(word, false)
  }
  const doRate = (lv: Level) => {
    if (!word) return
    rate(word.id, lv)
    rated.current.add(word.id)
    let q = queue
    if (lv === 1 && settings.requeueStrange !== false && (mode === 'today' || mode === 'review' || mode === 'catchup' || mode === 'weak') && (requeued.current.get(word.id) ?? 0) < 2) {
      requeued.current.set(word.id, (requeued.current.get(word.id) ?? 0) + 1)
      q = [...queue]; q.splice(Math.min(idx + 6, q.length), 0, word.id); setQueue(q)
    }
    sp.stop(); setFlip(false)
    if (idx + 1 >= q.length) setFinished(true); else setIdx(idx + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); if (e.key === ' ') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })

  const counts = useMemo(() => [0, 0, 0, 0, 0].map((_, l) => [...rated.current].filter(i => (progress.get(i)?.level ?? 0) === l).length), [finished, progress])

  if (!queue.length) return (
    <div className="study"><div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button></div>
      <div className="done"><div className="big">🎉</div><h2>这里没有需要学习的词</h2><p className="sub">{mode === 'weak' ? '没有陌生或不熟悉的词，继续保持！' : '词表为空'}</p></div></div>)

  if (finished) return (
    <div className="study"><div className="sthead"><button className="close" onClick={onClose}>完成</button></div>
      <div className="done"><div className="big">🎉</div><h1>{title} · 完成</h1>
        <p className="sub">本轮评级 {rated.current.size} 个词</p>
        <div className="chips" style={{ justifyContent: 'center', margin: '12px 0' }}>
          {[1, 2, 3, 4].map(l => <span key={l} className="pill" style={{ background: LEVEL_COLORS[l], fontSize: 14, padding: '4px 12px' }}>{LEVEL_NAMES[l]} {counts[l]}</span>)}
        </div>
        <button className="btn" onClick={onClose}>回到首页</button>
        <button className="btn sec block" onClick={() => { setQueue(ids); requeued.current.clear(); setFinished(false); setIdx(0); setFlip(false) }}>再看一遍</button>
      </div></div>)

  if (!word) return null
  const p = progress.get(word.id)
  return (
    <div className="study" role="dialog" aria-label={title}>
      <div className="sthead">
        <button className="close" onClick={() => { sp.stop(); onClose() }}>‹ 返回</button>
        <div className="prog"><div className="bar"><i style={{ width: `${(uniquePos / uniqueTotal) * 100}%`, background: 'var(--blue)' }} /></div></div>
        <div className="cnt">{uniquePos} / {uniqueTotal}</div>
      </div>
      <div className="stage">
        <div className={'card' + (flip ? ' flip' : '')} data-testid="card"
          onClick={() => { if (swiped.current) { swiped.current = false; return } toggle() }}
          onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; swiped.current = false }}
          onTouchEnd={e => {
            const t = touch.current; if (!t) return
            const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped.current = true; go(dx < 0 ? idx + 1 : idx - 1) }
            touch.current = null
          }}>
          <div className="face front">
            {level > 0 && <span className="lvbadge" style={{ background: LEVEL_COLORS[level] }}>{LEVEL_NAMES[level]}</span>}
            {isRepeat && <span className="rptbadge" data-testid="repeat-badge">↻ 陌生词 · 再看一遍</span>}
            <SpeakButtons word={word} sp={sp} />
            <div className="bigth th" lang="th" data-testid="thai">{word.thai}</div>
            <div className="hint">点击卡片翻面 · 左右滑动切换</div>
          </div>
          <div className="face back">
            {level > 0 && <span className="lvbadge" style={{ background: LEVEL_COLORS[level] }}>{LEVEL_NAMES[level]}</span>}
            {isRepeat && <span className="rptbadge" data-testid="repeat-badge">↻ 陌生词 · 再看一遍</span>}
            <SpeakButtons word={word} sp={sp} />
            <div className="th" lang="th" style={{ fontSize: 34 }}>{word.thai}</div>
            <div className="zh">{word.zh}</div>
            <div className="rom" style={{ fontSize: 22, color: 'var(--blue)', fontWeight: 600 }} data-testid="roman">{word.roman}</div>
            <ToneChips roman={word.roman} />
            <div className="ex">
              <div className="th" lang="th">{word.exTh}</div>
              <div className="rom">{word.exRoman}</div>
              <div className="z">{word.exZh}</div>
            </div>
            <div className="hint">{word.theme}{p ? ` · 已复习 ${p.reps} 次` : ' · 新词'}</div>
          </div>
        </div>
      </div>
      <div className={'rates' + (flip ? '' : ' off')} aria-label="选择熟练度">
        {([1, 2, 3, 4] as Level[]).map(l => (
          <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => doRate(l)} data-testid={'rate' + l}>{LEVEL_NAMES[l]}</button>
        ))}
      </div>
      <div className="nav">
        <button onClick={() => go(idx - 1)} disabled={idx === 0} data-testid="prev">‹ 上一词</button>
        <span className="sub">{flip ? '选择熟练度' : '先回忆，再翻面'}</span>
        <button onClick={() => go(idx + 1)} data-testid="next">下一词 ›</button>
      </div>
      {sp.toast}
    </div>
  )
}
