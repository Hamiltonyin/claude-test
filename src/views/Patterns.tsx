import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { ColorRoman, Speaker } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'

interface Ex { th: string; roman: string; zh: string; clip: string }
interface Pat { n: number; group: string; emoji: string; tpl: string; roman: string; zh: string; tip: string; ex: Ex[] }
interface Data { polite: { th: string; roman: string; zh: string }[]; patterns: Pat[] }

let cache: Promise<Data | null> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/patterns.json`).then(r => r.ok ? r.json() : null).catch(() => { cache = null; return null }))

/** 常用固定句式：和快递员沟通最常用的 30 个句型，每个带例句。客气词意思上可以不管，但要会听、会用。 */
export default function Patterns({ onClose }: { onClose: () => void }) {
  const { words, countPlay } = useApp()
  const [data, setData] = useState<Data | null>(null)
  const [hideZh, setHideZh] = useState(false)
  const [on, setOn] = useState<string | null>(null)
  useEffect(() => { let ok = true; load().then(d => ok && setData(d)); return () => { ok = false; stopAudio() } }, [])
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])
  const sayEx = async (e: Ex) => {
    setOn(e.clip); stopAudio()
    try { await playFile(e.clip, false) } catch { try { await playSystem(e.th, false) } catch { /* 没有语音 */ } }
    setOn(o => (o === e.clip ? null : o))
  }
  const sayWord = async (th: string) => {
    const w = byThai.get(th); setOn('w' + th); stopAudio()
    try { if (!w) throw new Error('none'); countPlay(w.id); await playFile(w.id, false) } catch { try { await playSystem(th, false) } catch { /* 没有语音 */ } }
    setOn(o => (o === 'w' + th ? null : o))
  }
  const groups = useMemo(() => {
    const m = new Map<string, Pat[]>()
    for (const p of data?.patterns ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p])
    return [...m.entries()]
  }, [data])
  return (
    <div className="study patpage" role="dialog" aria-label="常用句式">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>🧱 常用句式</b></div><div className="cnt">{data?.patterns.length ?? 0} 个</div></div>
      <div className="patlist">
        <div className="vowintro">
          <b>怎么用</b>
          <p>泰国人句子里有很多客气小词（ครับ、นะ、หน่อย、ด้วย…），<b>意思上基本可以不管</b>，抓住骨架就懂。但它们几乎每句都出现，要会听、会用，不然说出来很生硬。每个句式后面有 2 个例句，点一下读音。</p>
          <label className="verbhide"><input type="checkbox" checked={hideZh} onChange={e => setHideZh(e.target.checked)} data-testid="pat-hidezh" /> 遮住中文（自测）</label>
        </div>
        <h3 className="pich">先认识这些客气小词</h3>
        <div className="ptrow" data-testid="polite">
          {data?.polite.map(p => (
            <button key={p.th} className={'pt' + (on === 'w' + p.th ? ' on' : '')} onClick={() => void sayWord(p.th)}>
              <b className="th" lang="th">{p.th}</b><ColorRoman roman={p.roman} className="ptrom" /><i>{p.zh}</i>
            </button>))}
        </div>
        {groups.map(([g, list]) => (
          <section key={g}>
            <h3 className="pich">{list[0].emoji} {g}</h3>
            {list.map(p => (
              <div key={p.n} className="patcard" data-testid="pattern">
                <div className="pathead"><span className="patn">{p.n}</span><span className="patzh">{p.zh}</span></div>
                <div className="pattpl th" lang="th">{p.tpl}</div>
                <ColorRoman roman={p.roman} className="patrom" />
                <p className="pattip">💡 {p.tip}</p>
                {p.ex.map(e => (
                  <button key={e.clip} className={'patex' + (on === e.clip ? ' on' : '')} onClick={() => void sayEx(e)} data-testid="pat-ex">
                    <span className="th" lang="th">{e.th}</span>
                    <ColorRoman roman={e.roman} className="ptrom" />
                    {!hideZh && <i>{e.zh}</i>}
                    <span className="wspk" aria-hidden><Speaker /></span>
                  </button>))}
              </div>))}
          </section>))}
        <p className="sub" style={{ margin: '14px 4px' }}>句式和例句是我按常见说法整理的，没有母语者审过。声音是合成语音。</p>
      </div>
    </div>)
}
