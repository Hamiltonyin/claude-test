import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from '../types'
import { LevelPill, Sheet, ExampleBlock, loadPhrases, SpeakButtons, ToneChips, useSpeaker, Chev } from '../ui'
import { THEMES } from '../data/seed'
import { myAddedIds } from '../lib/srs'

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-\s]+/g, '')

export function WordSheet({ word, onClose }: { word: Word; onClose: () => void }) {
  const { progress, rate, updateWord, lessons, flips, countFlip } = useApp()
  const sp = useSpeaker()
  useEffect(() => { countFlip(word.id) }, [word.id])   // 打开词条查看 = 看了一次，和学习卡片翻面一样计数
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
        <div style={{ textAlign: 'left' }}><ExampleBlock word={word} /></div>
        <p className="flipline" data-testid="flips-sheet">已翻 {flips[word.id] ?? 0} 次</p>
        <p className="sub">{word.theme} · {days.length ? '出现在第 ' + days.join('、') + ' 天' : '未归入课程'}{p ? ` · 复习 ${p.reps} 次 · 遗忘 ${p.lapses} 次 · 下次 ${p.due}` : ''}</p>
        <div className="rates" style={{ padding: '8px 0' }}>
          {([1, 2, 3, 4] as Level[]).map(l => <button key={l} className={level === l ? 'cur' : ''} style={{ background: LEVEL_COLORS[l] }} onClick={() => rate(word.id, l === 4 && level < 4 ? 3 : l)}>{LEVEL_NAMES[l]}{l === 4 && level < 4 ? ' 🔒' : ''}</button>)}
        </div>
        <button className="btn sec block" onClick={() => setEdit(true)}>编辑词条</button>
        <button className="btn block" onClick={() => { sp.stop(); onClose() }} data-testid="sheet-close">关闭</button>
      </div> : <div>
        {F('thai', '泰文')}{F('roman', '带声调拼音（音节用 - 分隔）')}{F('zh', '中文释义')}{F('theme', '主题')}{F('exTh', '例句（泰文）')}{F('exRoman', '例句拼音')}{F('exZh', '例句中文')}
        <button className="btn block" onClick={async () => { await updateWord(d); setEdit(false) }}>保存</button>
        <button className="btn sec block" onClick={() => { setD(word); setEdit(false) }}>取消</button>
      </div>}
      {sp.toast}
    </Sheet>
  )
}

export default function Library({ onStudy, startMine, onMineShown, initialQuery, onQueryUsed }: { onStudy: (title: string, ids: string[], mode: 'day' | 'free') => void; startMine?: boolean; onMineShown?: () => void; initialQuery?: string; onQueryUsed?: () => void }) {
  const { words, progress, lessons, wordMap } = useApp()
  const [tab, setTab] = useState<'words' | 'days'>('words')
  const [q, setQ] = useState(initialQuery ?? '')
  useEffect(() => { if (initialQuery) onQueryUsed?.() }, [])
  const [extra, setExtra] = useState<Map<string, { ex: string; ph: string[] }>>(new Map())
  useEffect(() => { let on = true; loadPhrases().then(m => { if (!on) return; const e = new Map<string, { ex: string; ph: string[] }>(); for (const [t, v] of Object.entries(m) as [string, { items: { th: string; zh: string }[] }][]) e.set(t, { ex: '', ph: v.items.map((x: { th: string; zh: string }) => x.th + ' ' + x.zh) }); setExtra(e) }); return () => { on = false } }, [])
  const [lv, setLv] = useState<number | null>(null)
  const [theme, setTheme] = useState<string | null>(null)
  const [open, setOpen] = useState<Word | null>(null)
  const [day, setDay] = useState<number | null>(null)
  const [mine, setMine] = useState(!!startMine)
  useEffect(() => { if (startMine) onMineShown?.() }, [])   // 带着「我录入的词」筛选进来后，清掉父组件里的标记
  const mineIds = useMemo(() => myAddedIds(lessons), [lessons])
  const mineSet = useMemo(() => new Set(mineIds), [mineIds])

  const isZh = /[\u4e00-\u9fff]/.test(q)
  // 中文搜索：先精确（某个释义就是它），再开头匹配，再释义里包含，最后是例句/词组里出现。命中例句/词组的会标出来。
  const hits = useMemo(() => {
    const m = new Map<string, { score: number; via?: string }>()
    const k = q.trim()
    if (!k || !isZh) return m
    for (const w of words) {
      const segs = w.zh.split(/[；;]/).map(x => x.replace(/（[^）]*）|\([^)]*\)/g, '').trim())
      let score = 0, via: string | undefined
      if (segs.some(x => x === k)) score = 4
      else if (segs.some(x => x.startsWith(k))) score = 3
      else if (w.zh.includes(k)) score = 2
      else {
        const ph = extra.get(w.thai)?.ph.find(x => x.includes(k))
        if (w.exZh.includes(k)) { score = 1; via = '例句：' + w.exZh } else if (ph) { score = 0.5; via = '词组：' + ph }
      }
      if (score) m.set(w.id, { score, via })
    }
    return m
  }, [words, q, isZh, extra])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), ns = strip(q.trim())
    const out = words.filter(w => {
      if (mine && !mineSet.has(w.id)) return false
      if (lv !== null && (progress.get(w.id)?.level ?? 0) !== lv) return false
      if (theme && w.theme !== theme) return false
      if (!s) return true
      if (isZh) return hits.has(w.id)
      return w.thai.includes(q.trim()) || w.roman.toLowerCase().includes(s) || (ns.length > 0 && strip(w.roman).includes(ns))
    })
    return isZh ? out.sort((a, b) => (hits.get(b.id)?.score ?? 0) - (hits.get(a.id)?.score ?? 0)) : out
  }, [words, progress, q, lv, theme, mine, mineSet, isZh, hits])

  const Row = ({ w }: { w: Word }) => {
    const l = progress.get(w.id)?.level ?? 0
    return (
      <button className="row" onClick={() => setOpen(w)} data-testid="word-row">
        <span className="dot" style={{ background: LEVEL_COLORS[l] }} />
        <span className="w th" lang="th">{w.thai}</span>
        <span className="m"><div>{w.zh}</div><div className="sub rom">{w.roman}</div>{hits.get(w.id)?.via && <div className="sub via">{hits.get(w.id)!.via}</div>}</span>
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
          <button className={'chip' + (mine ? ' on' : '')} onClick={() => setMine(!mine)} data-testid="chip-mine">📝 我录入的词<small>{mineIds.length}</small></button>
          {[1, 2, 3, 4, 0].map(l => <button key={l} className={'chip' + (lv === l ? ' on' : '')} onClick={() => setLv(lv === l ? null : l)}>{LEVEL_NAMES[l]}</button>)}
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {THEMES.map(t => <button key={t} className={'chip' + (theme === t ? ' on' : '')} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>)}
        </div>
        {mine && list.length > 0 && <button className="btn block" style={{ marginTop: 0 }} onClick={() => onStudy('我录入的词', list.map(w => w.id), 'free')} data-testid="study-mine">学习这 {list.length} 个词</button>}
        <div className="sub" style={{ margin: '4px 0' }}>{list.length} 个结果{mine ? '（我录入的词：第18天起的课程）' : ''}</div>
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
