import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from '../types'
import { LevelPill, Sheet, SpeakButtons, ToneChips, useSpeaker, Chev } from '../ui'
import { THEMES } from '../data/seed'

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-\s]+/g, '')

export function WordSheet({ word, onClose }: { word: Word; onClose: () => void }) {
  const { progress, rate, updateWord, lessons } = useApp()
  const sp = useSpeaker()
  const [edit, setEdit] = useState(false)
  const [d, setD] = useState(word)
  const p = progress.get(word.id)
  const level = p?.level ?? 0
  const days = lessons.filter(l => l.wordIds.includes(word.id)).map(l => l.day)
  const F = (k: keyof Word, label: string) => <label className="field"><span>{label}</span><input value={String(d[k] ?? '')} onChange={e => setD({ ...d, [k]: e.target.value })} /></label>
  return (
    <Sheet onClose={() => { sp.stop(); onClose() }}>
      <div style={{ position: 'relative', minHeight: 56 }}><SpeakButtons word={word} sp={sp} /></div>
      {!edit ? <div style={{ textAlign: 'center' }}>
        <div className="th" lang="th" style={{ fontSize: 52 }}>{word.thai}</div>
        <div className="zh">{word.zh}</div>
        <div className="rom" style={{ fontSize: 20, color: 'var(--blue)', fontWeight: 600 }}>{word.roman}</div>
        <ToneChips roman={word.roman} />
        <div className="ex" style={{ background: 'var(--card)', textAlign: 'left' }}>
          <div className="th" lang="th">{word.exTh}</div><div className="rom">{word.exRoman}</div><div className="z">{word.exZh}</div>
        </div>
        <p className="sub">{word.theme} · {days.length ? '出现在第 ' + days.join('、') + ' 天' : '未归入课程'}{p ? ` · 复习 ${p.reps} 次 · 遗忘 ${p.lapses} 次 · 下次 ${p.due}` : ''}</p>
        <div className="rates" style={{ padding: '8px 0' }}>
          {([1, 2, 3, 4] as Level[]).map(l => <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => rate(word.id, l)}>{LEVEL_NAMES[l]}</button>)}
        </div>
        <button className="btn sec block" onClick={() => setEdit(true)}>编辑词条</button>
      </div> : <div>
        {F('thai', '泰文')}{F('roman', '带声调拼音（音节用 - 分隔）')}{F('zh', '中文释义')}{F('theme', '主题')}{F('exTh', '例句（泰文）')}{F('exRoman', '例句拼音')}{F('exZh', '例句中文')}
        <button className="btn block" onClick={async () => { await updateWord(d); setEdit(false) }}>保存</button>
        <button className="btn sec block" onClick={() => { setD(word); setEdit(false) }}>取消</button>
      </div>}
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

  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), ns = strip(q.trim())
    return words.filter(w => {
      if (lv !== null && (progress.get(w.id)?.level ?? 0) !== lv) return false
      if (theme && w.theme !== theme) return false
      if (!s) return true
      return w.thai.includes(q.trim()) || w.zh.includes(q.trim()) || w.roman.toLowerCase().includes(s) || (ns.length > 0 && strip(w.roman).includes(ns))
    })
  }, [words, progress, q, lv, theme])

  const Row = ({ w }: { w: Word }) => {
    const l = progress.get(w.id)?.level ?? 0
    return (
      <button className="row" onClick={() => setOpen(w)} data-testid="word-row">
        <span className="dot" style={{ background: LEVEL_COLORS[l] }} />
        <span className="w th" lang="th">{w.thai}</span>
        <span className="m"><div>{w.zh}</div><div className="sub rom">{w.roman}</div></span>
        <LevelPill level={l as Level} />
      </button>
    )
  }

  const lessonDetail = day !== null ? lessons.find(l => l.day === day) : null
  return (
    <>
      <h1>词库</h1>
      <div className="seg"><button className={tab === 'words' ? 'on' : ''} onClick={() => setTab('words')}>全部词汇 {words.length}</button><button className={tab === 'days' ? 'on' : ''} onClick={() => { setTab('days'); setDay(null) }}>按天课程 {lessons.length}</button></div>
      {tab === 'words' && <>
        <input className="search" placeholder="搜索中文 / 泰文 / 拼音" value={q} onChange={e => setQ(e.target.value)} data-testid="search" />
        <div className="chips" style={{ marginBottom: 8 }}>
          {[1, 2, 3, 4, 0].map(l => <button key={l} className={'chip' + (lv === l ? ' on' : '')} onClick={() => setLv(lv === l ? null : l)}>{LEVEL_NAMES[l]}</button>)}
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {THEMES.map(t => <button key={t} className={'chip' + (theme === t ? ' on' : '')} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>)}
        </div>
        <div className="sub" style={{ margin: '4px 0' }}>{list.length} 个结果</div>
        {list.map(w => <Row key={w.id} w={w} />)}
        {!list.length && <p className="sub">没有匹配的词。</p>}
      </>}
      {tab === 'days' && !lessonDetail && lessons.slice().sort((a, b) => b.day - a.day).map(l => {
        const c = [0, 0, 0, 0, 0]; l.wordIds.forEach(id => c[progress.get(id)?.level ?? 0]++)
        return (
          <button key={l.day} className="entry" onClick={() => setDay(l.day)} data-testid={'day-' + l.day}>
            <div className="ic" style={{ background: 'var(--blue)', fontSize: 16, fontWeight: 700 }}>D{l.day}</div>
            <div style={{ flex: 1 }}><div className="t">第 {l.day} 天 · {l.wordIds.length} 条</div>
              <div className="bar" style={{ marginTop: 8 }}>{[4, 3, 2, 1, 0].map(k => <i key={k} style={{ width: `${(c[k] / l.wordIds.length) * 100}%`, background: LEVEL_COLORS[k] }} />)}</div>
              <div className="d">精通 {c[4]} · 熟悉 {c[3]} · 不熟悉 {c[2]} · 陌生 {c[1]} · 未标记 {c[0]}</div></div><Chev />
          </button>)
      })}
      {tab === 'days' && lessonDetail && <>
        <button className="chip" onClick={() => setDay(null)}>‹ 所有课程</button>
        <h2>第 {lessonDetail.day} 天（{lessonDetail.wordIds.length} 条）</h2>
        <button className="btn block" style={{ marginTop: 0 }} onClick={() => onStudy(`第${lessonDetail.day}天`, lessonDetail.wordIds, 'day')}>学习本课全部词</button>
        {lessonDetail.wordIds.map(id => wordMap.get(id)).filter(Boolean).map(w => <Row key={w!.id} w={w!} />)}
      </>}
      {open && <WordSheet word={open} onClose={() => setOpen(null)} />}
    </>
  )
}
