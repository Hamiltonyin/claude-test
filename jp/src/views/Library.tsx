import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from '../types'
import { LevelPill, Sheet, SpeakButtons, useSpeaker, Chev } from '../ui'
import { kataToHira } from '../lib/romaji'

const strip = (s: string) => s.toLowerCase().replace(/[-\s']+/g, '')

export function WordSheet({ word, onClose }: { word: Word; onClose: () => void }) {
  const { progress, rate, lessons } = useApp()
  const sp = useSpeaker()
  const p = progress.get(word.id)
  const level = p?.level ?? 0
  const days = lessons.filter(l => l.wordIds.includes(word.id)).map(l => l.day)
  const isKana = word.kind !== 'word'
  return (
    <Sheet onClose={() => { sp.stop(); onClose() }}>
      <div style={{ position: 'relative', minHeight: 56 }}><SpeakButtons word={word} sp={sp} /></div>
      <div style={{ textAlign: 'center' }}>
        <div className="jp" lang="ja" style={{ fontSize: isKana ? 88 : 44 }}>{word.jp}</div>
        {!isKana && word.reading !== word.jp && <div className="jp rd" lang="ja">{word.reading}</div>}
        <div className="rom" style={{ fontSize: 22, color: 'var(--blue)', fontWeight: 700 }}>{word.romaji}</div>
        <div className="zh" style={{ fontSize: isKana ? 18 : 26 }}>{word.zh}</div>
        {word.note && <div className="note-s">{word.note}</div>}
        {word.exJp && <div className="ex" style={{ background: 'var(--card)', textAlign: 'left' }}>
          <div className="jp" lang="ja">{word.exJp}</div>
          {word.exReading !== word.exJp && <div className="jp sub" lang="ja" style={{ fontSize: 14 }}>{word.exReading}</div>}
          <div className="z">{word.exZh}</div>
        </div>}
        <p className="sub">{word.theme} · {days.length ? '出现在第 ' + days.join('、') + ' 天' : '未归入课程'}{p ? ` · 复习 ${p.reps} 次 · 遗忘 ${p.lapses} 次 · 下次 ${p.due}` : ''}</p>
        <div className="rates" style={{ padding: '8px 0' }}>
          {([1, 2, 3, 4] as Level[]).map(l => <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => rate(word.id, l)}>{LEVEL_NAMES[l]}</button>)}
        </div>
      </div>
      {sp.toast}
    </Sheet>
  )
}

export default function Library({ onStudy }: { onStudy: (title: string, ids: string[], mode: 'day' | 'free') => void }) {
  const { words, progress, lessons, wordMap } = useApp()
  const [tab, setTab] = useState<'words' | 'days'>('words')
  const [q, setQ] = useState('')
  const [lv, setLv] = useState<number | null>(null)
  const [theme, setTheme] = useState<string | null>(null)
  const [open, setOpen] = useState<Word | null>(null)
  const [day, setDay] = useState<number | null>(null)
  const themes = useMemo(() => [...new Set(words.map(w => w.theme))], [words])

  const list = useMemo(() => {
    const t = q.trim(), s = strip(t), h = kataToHira(t)
    return words.filter(w => {
      if (lv !== null && (progress.get(w.id)?.level ?? 0) !== lv) return false
      if (theme && w.theme !== theme) return false
      if (!t) return true
      return w.jp.includes(t) || kataToHira(w.reading).includes(h) || w.zh.includes(t) || strip(w.romaji).includes(s)
    })
  }, [words, progress, q, lv, theme])

  const Row = ({ w }: { w: Word }) => {
    const l = progress.get(w.id)?.level ?? 0
    return (
      <button className="row" onClick={() => setOpen(w)} data-testid="word-row">
        <span className="dot" style={{ background: LEVEL_COLORS[l] }} />
        <span className="w jp" lang="ja" style={{ fontSize: w.jp.length > 4 ? 15 : 22 }}>{w.jp}</span>
        <span className="m"><div>{w.zh}</div><div className="sub rom">{w.reading !== w.jp ? `${w.reading} · ` : ''}{w.romaji}</div></span>
        <LevelPill level={l as Level} />
      </button>
    )
  }
  const lessonDetail = day !== null ? lessons.find(l => l.day === day) : null
  return (
    <>
      <h1>卡片库</h1>
      <div className="seg"><button className={tab === 'words' ? 'on' : ''} onClick={() => setTab('words')}>全部卡片 {words.length}</button><button className={tab === 'days' ? 'on' : ''} onClick={() => { setTab('days'); setDay(null) }}>按天课程 {lessons.length}</button></div>
      {tab === 'words' && <>
        <input className="search" placeholder="搜索 日文 / 假名 / 罗马音 / 中文" value={q} onChange={e => setQ(e.target.value)} data-testid="search" />
        <div className="chips" style={{ marginBottom: 8 }}>
          {[1, 2, 3, 4, 0].map(l => <button key={l} className={'chip' + (lv === l ? ' on' : '')} onClick={() => setLv(lv === l ? null : l)}>{LEVEL_NAMES[l]}</button>)}
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {themes.map(t => <button key={t} className={'chip' + (theme === t ? ' on' : '')} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>)}
        </div>
        <div className="sub" style={{ margin: '4px 0' }}>{list.length} 个结果</div>
        {list.slice(0, 200).map(w => <Row key={w.id} w={w} />)}
        {list.length > 200 && <p className="sub">只显示前 200 个，请缩小范围。</p>}
        {!list.length && <p className="sub">没有匹配的卡片。</p>}
      </>}
      {tab === 'days' && !lessonDetail && lessons.slice().sort((a, b) => a.day - b.day).map(l => {
        const c = [0, 0, 0, 0, 0]; l.wordIds.forEach(id => c[progress.get(id)?.level ?? 0]++)
        return (
          <button key={l.day} className="entry" onClick={() => setDay(l.day)} data-testid={'day-' + l.day}>
            <div className="ic" style={{ background: 'var(--blue)', fontSize: 16, fontWeight: 700 }}>D{l.day}</div>
            <div style={{ flex: 1 }}><div className="t" style={{ fontSize: 15 }}>{l.title ?? `第 ${l.day} 天`}</div>
              <div className="bar" style={{ marginTop: 8 }}>{[4, 3, 2, 1, 0].map(k => <i key={k} style={{ width: `${(c[k] / l.wordIds.length) * 100}%`, background: LEVEL_COLORS[k] }} />)}</div>
              <div className="d">{l.wordIds.length} 张 · 精通 {c[4]} · 熟悉 {c[3]} · 不熟悉 {c[2]} · 陌生 {c[1]} · 未标记 {c[0]}</div></div><Chev />
          </button>)
      })}
      {tab === 'days' && lessonDetail && <>
        <button className="chip" onClick={() => setDay(null)}>‹ 所有课程</button>
        <h2>第 {lessonDetail.day} 天 · {lessonDetail.title}（{lessonDetail.wordIds.length} 张）</h2>
        <button className="btn block" style={{ marginTop: 0 }} onClick={() => onStudy(`第${lessonDetail.day}天`, lessonDetail.wordIds, 'day')}>学习本课全部卡片</button>
        {lessonDetail.wordIds.map(id => wordMap.get(id)).filter(Boolean).map(w => <Row key={w!.id} w={w!} />)}
      </>}
      {open && <WordSheet word={open} onClose={() => setOpen(null)} />}
    </>
  )
}
