import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { LEVEL_COLORS, LEVEL_NAMES } from '../types'
import { ColorRoman, Sheet, Speaker } from '../ui'
import { playFile, playSystem } from '../lib/audio'
import type { StudyMode } from './Study'

interface Cat { id: string; name: string; emoji: string; words: string[] }
interface Group { name: string; icon: string; own?: boolean; cats: Cat[] }

let cache: Promise<Group[]> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/categories.json`).then(r => r.ok ? r.json() : { groups: [] }).then(j => j.groups as Group[]).catch(() => { cache = null; return [] }))

/** 按主题浏览：不受「第几天」课程限制，任何分类随时可以学；评级照常计入复习。 */
export default function Categories({ onStudy }: { onStudy: (title: string, ids: string[], mode: StudyMode) => void }) {
  const { allWords: words, wordMap, progress, countPlay } = useApp()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const sayWord = async (w: { id: string; thai: string }) => {
    countPlay(w.id); setPlayingId(w.id)
    try { await playFile(w.id, false) } catch { try { await playSystem(w.thai, false) } catch { /* 没有语音 */ } }
    setPlayingId(p => (p === w.id ? null : p))
  }
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [open, setOpen] = useState<Cat | null>(null)
  const [showLocked, setShowLocked] = useState(false)   // 还没有词的分类默认收起
  useEffect(() => { let on = true; load().then(g => on && setGroups(g)); return () => { on = false } }, [])

  const idOf = useMemo(() => new Map(words.map(w => [w.thai, w.id])), [words])
  const idsOf = (c: Cat) => c.words.map(t => idOf.get(t)).filter((x): x is string => !!x)
  const stat = (c: Cat) => { const ids = idsOf(c); return { ids, learned: ids.filter(i => (progress.get(i)?.level ?? 0) > 0).length } }

  if (!groups) return <div className="cats"><p className="sub" style={{ textAlign: 'center', padding: 40 }}>加载中…</p></div>
  const unlocked = groups.filter(g => !g.own).flatMap(g => g.cats).filter(c => c.words.length)

  const card = (c: Cat, locked: boolean) => {
    const s = stat(c)
    return (
      <button key={c.id} className={'catcard' + (locked ? ' locked' : '')} disabled={locked} onClick={() => setOpen(c)} data-testid={'cat-' + c.id}>
        <span className="catemoji"><span>{c.emoji}</span>{locked && <i className="catlock">🔒</i>}</span>
        <b>{c.name}</b>
        {!locked && <small>已学 {s.learned}/{s.ids.length}</small>}
      </button>)
  }
  const head = (icon: string, title: string) => <div className="cathead"><span className="caticon">{icon}</span><h2>{title}</h2><hr /><em>◆</em></div>

  const cur = open ? stat(open) : null
  const lv = (id: string) => progress.get(id)?.level ?? 0
  return (
    <div className="cats">
      
      <div className="catgrid">{unlocked.map(c => card(c, false))}</div>
      {groups.some(g => !g.own && g.cats.some(c => !c.words.length)) && <button className="catmore" onClick={() => setShowLocked(!showLocked)} data-testid="cat-more">{showLocked ? '收起未开放分类 ▴' : '未开放分类 ▾'}</button>}
      {groups.map(g => {
        if (g.own) return <div key={g.name}>{head(g.icon, g.name)}<div className="catgrid">{g.cats.map(c => card(c, !c.words.length))}</div></div>
        const locked = g.cats.filter(c => !c.words.length)
        return showLocked && locked.length ? <div key={g.name}>{head(g.icon, g.name)}<div className="catgrid">{locked.map(c => card(c, true))}</div></div> : null
      })}
      {open && cur && (
        <Sheet onClose={() => setOpen(null)}>
          <h2>{open.emoji} {open.name}</h2>
          <p className="sub">共 {cur.ids.length} 个词 · 已学 {cur.learned} 个 · 不受每天课程限制，随时可学</p>
          <button className="btn block" onClick={() => { const t = open; setOpen(null); onStudy(t.name, [...cur.ids].sort((a, b) => (lv(a) || 0.5) - (lv(b) || 0.5)), 'theme') }} data-testid="cat-all">学习全部 {cur.ids.length} 个词</button>
          <button className="btn sec block" disabled={cur.ids.length === cur.learned} onClick={() => { const t = open; setOpen(null); onStudy(t.name + ' · 新词', cur.ids.filter(i => lv(i) === 0), 'theme') }} data-testid="cat-fresh">只学还没学过的（{cur.ids.length - cur.learned}）</button>
          <div className="catlist">
            {cur.ids.map(id => { const w = wordMap.get(id)!; const l = lv(id); return (
              <div key={id} className={'catrow tap' + (playingId === id ? ' on' : '')} role="button" tabIndex={0} onClick={() => void sayWord(w)} onKeyDown={e => { if (e.key === 'Enter') void sayWord(w) }} data-testid="cat-word">
                <span className="th" lang="th">{w.thai}</span>
                <span className="catmid"><ColorRoman roman={w.roman} className="relrom" /><span className="sub">{w.zh.split(/[；;]/)[0]}</span></span>
                {l > 0 && <span className="pill" style={{ background: LEVEL_COLORS[l] }}>{LEVEL_NAMES[l]}</span>}
                <span className="wspk" aria-hidden><Speaker /></span></div>) })}
          </div>
          <button className="btn sec block" onClick={() => setOpen(null)}>关闭</button>
        </Sheet>)}
    </div>)
}
