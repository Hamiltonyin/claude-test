import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from '../types'
import { SpeakButtons, useSpeaker } from '../ui'

type Kind = 'hira' | 'kata'
type Section = 'seion' | 'dakuon' | 'yoon'
const SECTION_NAME: Record<Section, string> = { seion: '清音', dakuon: '浊音・半浊音', yoon: '拗音' }
const ROW_ORDER: Record<Section, string[]> = {
  seion: ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa', 'n'],
  dakuon: ['ga', 'za', 'da', 'ba', 'pa'],
  yoon: ['ky', 'sh', 'ch', 'ny', 'hy', 'my', 'ry', 'gy', 'j', 'by', 'py'],
}

/** 五十音图：点任意假名即发音并显示详情；颜色 = 你的熟练度 */
export default function KanaChart() {
  const { words, progress, rate } = useApp()
  const sp = useSpeaker()
  const [kind, setKind] = useState<Kind>('hira')
  const [section, setSection] = useState<Section>('seion')
  const [sel, setSel] = useState<Word | null>(null)

  const grid = useMemo(() => {
    const m = new Map<string, Word>()
    for (const w of words) if (w.kind === kind && w.grid) m.set(w.grid, w)
    return m
  }, [words, kind])
  const cols = section === 'yoon' ? 3 : 5
  const learned = words.filter(w => w.kind === kind).filter(w => (progress.get(w.id)?.level ?? 0) >= 3).length
  const total = words.filter(w => w.kind === kind).length
  const level = sel ? ((progress.get(sel.id)?.level ?? 0) as Level) : 0

  return (
    <>
      <h1>五十音图</h1>
      <div className="seg"><button className={kind === 'hira' ? 'on' : ''} onClick={() => { setKind('hira'); setSel(null) }} data-testid="kind-hira">平假名 ひらがな</button><button className={kind === 'kata' ? 'on' : ''} onClick={() => { setKind('kata'); setSel(null) }} data-testid="kind-kata">片假名 カタカナ</button></div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {(Object.keys(SECTION_NAME) as Section[]).map(s => <button key={s} className={'chip' + (section === s ? ' on' : '')} onClick={() => { setSection(s); setSel(null) }}>{SECTION_NAME[s]}</button>)}
      </div>
      <p className="sub">点一下假名就会发音。颜色代表熟练度，已熟悉及以上 {learned}/{total}。</p>
      <div className="kgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} data-testid="kana-grid">
        {ROW_ORDER[section].flatMap(row => Array.from({ length: cols }, (_, c) => {
          const w = grid.get(`${section}|${row}|${c}`)
          if (!w) return <div key={row + c} className="kcell empty" />
          const l = (progress.get(w.id)?.level ?? 0) as Level
          return (
            <button key={w.id} className={'kcell' + (sel?.id === w.id ? ' sel' : '')} style={{ borderColor: l ? LEVEL_COLORS[l] : 'transparent', background: l ? LEVEL_COLORS[l] + '22' : 'var(--card)' }}
              onClick={() => { setSel(w); sp.play(w, false) }} data-testid="kana-cell">
              <span className="jp kc">{w.jp}</span><span className="kr rom">{w.romaji}</span>
            </button>)
        }))}
      </div>
      {sel && (
        <div className="panel" style={{ marginTop: 14, position: 'relative' }} data-testid="kana-detail">
          <div style={{ position: 'relative', minHeight: 50 }}><SpeakButtons word={sel} sp={sp} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="jp" style={{ fontSize: 72, lineHeight: 1 }}>{sel.jp}</div>
            <div><div className="rom" style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)' }}>{sel.romaji}</div>
              <div className="sub">{sel.zh}</div></div>
          </div>
          {sel.note && <div className="note-s">{sel.note}</div>}
          {sel.exJp && <div className="ex"><div className="jp" style={{ fontSize: 20 }}>{sel.exJp}{sel.exReading !== sel.exJp && <span className="sub" style={{ fontSize: 14 }}>　{sel.exReading}</span>}</div><div className="z">{sel.exZh}</div></div>}
          <div className="rates" style={{ padding: '10px 0 0' }}>
            {([1, 2, 3, 4] as Level[]).map(l => <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => rate(sel.id, l)}>{LEVEL_NAMES[l]}</button>)}
          </div>
        </div>
      )}
      {sp.toast}
    </>
  )
}
