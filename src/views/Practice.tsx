import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level } from '../types'
import { masterQuestions, verifyQuestions } from '../lib/quiz'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { SpeakButtons, useSpeaker } from '../ui'

export type PracticeKind = 'verify' | 'master'
const ROUND = 10

/** 升级通道：验收（陌生/不熟悉 → 升一级）、举一反三（熟悉 → 精通）。一个词的题全对才升级，错了保持原级别。 */
export default function Practice({ kind, onClose }: { kind: PracticeKind; onClose: () => void }) {
  const { words, wordMap, progress, rate } = useApp()
  const sp = useSpeaker()
  const lvOf = (id: string) => progress.get(id)?.level ?? 0
  const ids = useMemo(() => {
    const ok = (l: number) => kind === 'master' ? l === 3 : l === 1 || l === 2
    return [...progress.values()].filter(p => ok(p.level) && wordMap.has(p.wordId))
      .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')).map(p => p.wordId).slice(0, ROUND)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => ids.map(id => (kind === 'master' ? masterQuestions : verifyQuestions)(wordMap.get(id)!, words)), [ids]) // eslint-disable-line react-hooks/exhaustive-deps
  const [wi, setWi] = useState(0)
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const missed = useRef(false)
  const results = useRef<{ id: string; from: Level; to: Level }[]>([])
  const [done, setDone] = useState(false)

  const title = kind === 'master' ? '熟悉 → 精通 · 举一反三' : '验收 · 升级一级'
  const sayWord = (id: string) => { stopAudio(); playFile(id, false).catch(() => playSystem(wordMap.get(id)!.thai, false)) }
  const autoListen = (w: number, q: number) => { const nq = plan[w]?.[q]; if (nq?.type === 'listen') sayWord(nq.word.id) }   // 在点击回调里同步触发，iPhone 才允许

  const answer = (opt: string) => {
    if (picked) return
    setPicked(opt)
    if (opt !== plan[wi][qi].answer) missed.current = true
  }
  const next = () => {
    const id = ids[wi]
    if (qi + 1 < plan[wi].length) { setQi(qi + 1); setPicked(null); autoListen(wi, qi + 1); return }
    const from = lvOf(id) as Level
    const to: Level = missed.current ? from : (Math.min(4, from + 1) as Level)
    results.current.push({ id, from, to })
    void rate(id, to)
    missed.current = false
    if (wi + 1 >= plan.length) { setDone(true); stopAudio(); return }
    setWi(wi + 1); setQi(0); setPicked(null); autoListen(wi + 1, 0)
  }

  const head = (
    <div className="sthead"><button className="close" onClick={() => { stopAudio(); onClose() }}>‹ 返回</button>
      <div className="prog"><b>{title}</b></div><div className="cnt">{done ? '' : `${wi + 1}/${plan.length}`}</div></div>)

  if (!plan.length) return (
    <div className="study">{head}
      <div className="done"><div className="big">{kind === 'master' ? '🌱' : '✅'}</div>
        <h2>{kind === 'master' ? '还没有「熟悉」的词' : '没有需要验收的词'}</h2>
        <p className="sub">{kind === 'master' ? '先在学习里把词标为「熟悉」，或用验收升到熟悉，再来举一反三。' : '陌生、不熟悉的词都清空了，真棒！'}</p></div></div>)

  if (done) {
    const up = results.current.filter(r => r.to > r.from)
    return (
      <div className="study">{head}
        <div className="done" data-testid="practice-done"><div className="big">{up.length ? '🎉' : '💪'}</div>
          <h2>升级 {up.length} / {results.current.length} 个词</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '12px 0' }}>
            {results.current.map(r => { const w = wordMap.get(r.id)!; return (
              <span key={r.id} className="pill th" lang="th" style={{ background: LEVEL_COLORS[r.to], fontSize: 15, padding: '4px 12px', opacity: r.to > r.from ? 1 : .55 }}>
                {w.thai} {r.to > r.from ? `→ ${LEVEL_NAMES[r.to]}` : '再练'}</span>) })}
          </div>
          <p className="sub">没升级的词保持原级别，之后继续练。</p>
          <button className="btn block" onClick={onClose}>完成</button></div></div>)
  }

  const q = plan[wi][qi]
  const w = q.word
  const isTh = q.type === 'zh2th' || q.type === 'cloze'
  const lead = { listen: '听音，选出意思', zh2th: '选出对应的泰语', cloze: '例句填空，选出缺的词', th2zh: '选出意思' }[q.type]
  return (
    <div className="study">{head}
      <div style={{ padding: '0 16px calc(var(--sab) + 24px)', flex: 1, overflowY: 'auto' }}>
        <p className="sub" style={{ textAlign: 'center', margin: '0 0 6px' }}>{`题 ${qi + 1}/${plan[wi].length} · 全部答对才升「${LEVEL_NAMES[Math.min(4, lvOf(ids[wi]) + 1)]}」`}</p>
        <div className="qcard">
          <div className="sub" style={{ marginBottom: 8 }}>{lead}</div>
          {q.type === 'listen' && <><button className="btn" onClick={() => sayWord(w.id)} data-testid="q-play">🔊 播放</button>
            {picked && <div className="th" lang="th" style={{ fontSize: 26 }}>{w.thai}</div>}</>}
          {q.type === 'th2zh' && <div className="th" lang="th" style={{ fontSize: 34 }}>{w.thai}</div>}
          {q.type === 'zh2th' && <div style={{ fontSize: 24, fontWeight: 600 }} data-testid="q-prompt">{q.prompt}</div>}
          {q.type === 'cloze' && <><div className="th" lang="th" style={{ fontSize: 24 }} data-testid="q-prompt">{q.prompt}</div><div className="sub" style={{ marginTop: 6 }}>{q.hint}</div></>}
          {picked && q.type !== 'listen' && <div className="qspk"><SpeakButtons word={w} sp={sp} /></div>}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {q.options.map(o => {
            const right = !!picked && o === q.answer, wrong = picked === o && o !== q.answer
            return <button key={o} className={'btn sec' + (isTh ? ' th' : '')} lang={isTh ? 'th' : undefined} disabled={!!picked && !right && !wrong}
              style={{ minHeight: 46, padding: '6px 12px', fontSize: isTh ? 20 : 16, background: right ? '#e3f7e8' : wrong ? '#ffe5e3' : undefined, color: right ? '#1f8a3b' : wrong ? 'var(--red)' : undefined }}
              onClick={() => answer(o)} data-testid="q-opt" data-right={o === q.answer ? '1' : '0'}>{o}</button>
          })}
        </div>
        {picked && <>
          <p style={{ textAlign: 'center', fontWeight: 600, margin: '8px 0 2px', color: picked === q.answer ? '#1f8a3b' : 'var(--red)' }}>
            {picked === q.answer ? '✔ 答对了' : `✘ 正确答案：${q.answer}`}</p>
          <p className="sub" style={{ textAlign: 'center', margin: '0 0 4px' }}>{w.thai} · {w.roman} · {w.zh}</p>
          <button className="btn block" onClick={next} data-testid="q-next">{qi + 1 < plan[wi].length ? '下一题' : '这个词完成，下一个'}</button>
        </>}
      </div>
    </div>)
}
