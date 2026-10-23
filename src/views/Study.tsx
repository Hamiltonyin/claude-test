import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level } from '../types'
import { SpeakButtons, ToneChips, useSpeaker } from '../ui'
import { today } from '../lib/dates'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { zhSpeakText } from '../lib/zhspeak'

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const AUTO_REPEATS = 3          // 自动连读：每个词读几遍（泰语）

/** 读中文意思：优先用保存好的中文 MP3（<词ID>_zh.mp3）；还没生成时，改用手机自带的中文语音。 */
async function playZh(id: string, zh: string) {
  try { await playFile(id, false, '_zh') }
  catch { await playSystem(zhSpeakText(zh), false, 'zh') }
}

export type StudyMode = 'today' | 'review' | 'catchup' | 'weak' | 'theme' | 'day' | 'free'

export default function Study({ title, ids, mode, onClose }: { title: string; ids: string[]; mode: StudyMode; onClose: () => void }) {
  const { wordMap, progress, logs, rate, settings, updateSettings } = useApp()
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
  const [auto, setAuto] = useState<{ rep: number; zh?: boolean } | null>(null)
  const [autoMsg, setAutoMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const autoTok = useRef(0)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const id = queue[idx]
  const isRepeat = !!id && queue.indexOf(id) < idx          // 同一个词在本轮更早出现过 = 陌生词重现
  const uniqueTotal = useMemo(() => new Set(queue).size, [queue])
  const uniquePos = useMemo(() => new Set(queue.slice(0, idx + 1)).size, [queue, idx])
  const word = id ? wordMap.get(id) : undefined
  const level = (id && progress.get(id)?.level) || 0

  const stopAuto = () => { autoTok.current++; stopAudio(); setAuto(null) }
  useEffect(() => () => { autoTok.current++; stopAudio() }, [])   // 离开学习界面时停止连读

  /** 自动连读：从第 from 个词开始，按顺序每个词读 AUTO_REPEATS 遍，读完自动翻到下一个，直到这一组读完。
   *  第一次播放在点击回调里同步发生（iPhone 要求），之后沿用同一个播放器继续。 */
  const startAuto = (from: number) => {
    const tok = ++autoTok.current
    setAutoMsg(null); sp.stop()
    const list = queue
    let zhOk = true
    void (async () => {
      try {
        for (let i = from; i < list.length; i++) {
          const w = wordMap.get(list[i]); if (!w) continue
          setIdx(i); setFlip(true)
          for (let r = 1; r <= AUTO_REPEATS; r++) {
            if (autoTok.current !== tok) return
            setAuto({ rep: r })
            await playFile(w.id, false)
            if (autoTok.current !== tok) return
            await sleep(900)
            if (autoTok.current !== tok) return       // 停顿期间被点了「停止」就不能再继续读
            // 泰语第 1 遍之后读一遍中文意思：泰语 → 中文 → 泰语 → 泰语
            if (r === 1 && zhOk && settings.readZh !== false) {
              setAuto({ rep: r, zh: true })
              try { await playZh(w.id, w.zh) }
              catch { zhOk = false; if (autoTok.current === tok) setAutoMsg({ t: 'err', s: '中文意思暂时读不出来（中文音频还没生成，设备也没有中文语音），本轮只读泰语。' }) }
              if (autoTok.current !== tok) return
              await sleep(700)
              if (autoTok.current !== tok) return
            }
          }
          await sleep(300)
          if (autoTok.current !== tok) return
        }
        if (autoTok.current === tok) { setAuto(null); setAutoMsg({ t: 'ok', s: `这一组 ${list.length} 个词已全部连读完毕。` }) }
      } catch (e: any) {
        if (autoTok.current === tok) { setAuto(null); setAutoMsg({ t: 'err', s: '连读中断：' + (e?.message || e) }) }
      }
    })()
  }

  const go = (to: number) => {
    stopAuto(); sp.stop(); setFlip(false)
    if (to >= queue.length) { setFinished(true); return }
    if (to < 0) return
    setIdx(to)
  }
  const toggle = () => {
    if (auto) { stopAuto(); return }          // 连读时点卡片 = 停止连读
    const nf = !flip; setFlip(nf)
    // 翻到背面时自动朗读（在点击回调里同步触发，iPhone 才允许）；可在「我的」里关闭
    if (nf && word && settings.autoPlay) sp.play(word, false)
  }
  const [lockMsg, setLockMsg] = useState(false)
  const doRate = (lv: Level) => {
    if (!word) return
    // 精通要靠「举一反三」练习升级，不能在这里直接点：先记为熟悉
    if (lv === 4 && level < 4) { lv = 3; setLockMsg(true) } else setLockMsg(false)
    rate(word.id, lv)
    rated.current.add(word.id)
    let q = queue
    if (lv === 1 && settings.requeueStrange !== false && (mode === 'today' || mode === 'review' || mode === 'catchup' || mode === 'weak') && (requeued.current.get(word.id) ?? 0) < 2) {
      requeued.current.set(word.id, (requeued.current.get(word.id) ?? 0) + 1)
      q = [...queue]; q.splice(Math.min(idx + 6, q.length), 0, word.id); setQueue(q)
    }
    stopAuto(); sp.stop(); setFlip(false)
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
      <div className="autorow">
        <button className={'autobtn' + (auto ? ' on' : '')} onClick={() => auto ? stopAuto() : startAuto(idx)} data-testid="auto-read">
          {auto ? `⏹ 停止连读 · ${auto.zh ? '读中文' : `泰语第 ${auto.rep}/${AUTO_REPEATS} 遍`} · ${uniquePos}/${uniqueTotal}` : `▶ 自动连读：每个词 泰语${AUTO_REPEATS}遍${settings.readZh !== false ? ' + 中文' : ''}`}
        </button>
        <label className="zhtoggle"><input type="checkbox" checked={settings.readZh !== false} onChange={e => updateSettings({ readZh: e.target.checked })} data-testid="read-zh" /> 同时读中文意思</label>
        {autoMsg && <div className={'note ' + autoMsg.t} style={{ marginTop: 6 }} role="status" data-testid="auto-msg">{autoMsg.s}</div>}
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
          <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => doRate(l)} data-testid={'rate' + l}>{LEVEL_NAMES[l]}{l === 4 && level < 4 ? ' 🔒' : ''}</button>
        ))}
      </div>
      {lockMsg && <p className="sub" style={{ textAlign: 'center', color: 'var(--orange)' }} data-testid="lock-msg">精通要通过「举一反三」练习才能升，已先记为熟悉（首页 → 熟悉 → 精通）</p>}
      <div className="nav">
        <button onClick={() => go(idx - 1)} disabled={idx === 0} data-testid="prev">‹ 上一词</button>
        <span className="sub">{flip ? '选择熟练度' : '先回忆，再翻面'}</span>
        <button onClick={() => go(idx + 1)} data-testid="next">下一词 ›</button>
      </div>
      {sp.toast}
    </div>
  )
}
