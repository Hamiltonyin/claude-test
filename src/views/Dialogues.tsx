import { useEffect, useRef, useState } from 'react'
import { ColorRoman, Speaker } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'

interface Line { n: number; who: string; me: boolean; th: string; roman: string; zh: string; clip: string }
type Item = Line | { sec: string }
interface Dlg { id: string; title: string; scene: string; emoji: string; items: Item[] }
const isLine = (x: Item): x is Line => 'clip' in x

let cache: Promise<Dlg[]> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/dialogues.json`).then(r => r.ok ? r.json() : []).catch(() => { cache = null; return [] }))

const pref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem('thai30-dlg-' + k); return v === null ? d : JSON.parse(v) } catch { return d } }
const savePref = (k: string, v: unknown) => { try { localStorage.setItem('thai30-dlg-' + k, JSON.stringify(v)) } catch { /* 无痕模式 */ } }

/** 情景对话：像聊天记录一样一句一句看、一句一句听；可以只看中文遮住泰文自测。对话内容在 content/dialogues/*.txt。 */
export default function Dialogues({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Dlg[] | null>(null)
  const [cur, setCur] = useState<Dlg | null>(null)
  const [showRoman, setShowRoman] = useState(() => pref('roman', true))
  const [showZh, setShowZh] = useState(() => pref('zh', true))
  const [hideTh, setHideTh] = useState(() => pref('hideTh', false))
  const [peek, setPeek] = useState<Set<number>>(new Set())      // 遮住泰文时，点开看的那几句
  const [playing, setPlaying] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const tok = useRef(0)
  const refs = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => { let on = true; load().then(d => on && setList(d)); return () => { on = false } }, [])
  useEffect(() => () => { tok.current++; stopAudio() }, [])
  useEffect(() => { savePref('roman', showRoman); savePref('zh', showZh); savePref('hideTh', hideTh) }, [showRoman, showZh, hideTh])

  const say = async (l: Line, slow = false) => {
    setPlaying(l.n)
    try { await playFile(l.clip, slow) } catch { try { await playSystem(l.th, slow) } catch { /* 没有音频也没有系统语音 */ } }
  }
  const playOne = (l: Line, slow = false) => { tok.current++; setAll(false); void say(l, slow).then(() => setPlaying(p => (p === l.n ? null : p))) }
  const playAll = () => {
    if (!cur) return
    if (all) { tok.current++; stopAudio(); setAll(false); setPlaying(null); return }
    const my = ++tok.current; setAll(true)
    const lines = cur.items.filter(isLine)
    void (async () => {
      for (const l of lines) {
        if (tok.current !== my) return
        refs.current.get(l.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await say(l)
        if (tok.current !== my) return
        await new Promise(r => setTimeout(r, 650))
      }
      if (tok.current === my) { setAll(false); setPlaying(null) }
    })()
  }

  if (!cur) return (
    <div className="study dlgpage" role="dialog" aria-label="情景对话">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>情景对话</b></div></div>
      <div className="dlglist">
        {!list ? <p className="sub">加载中…</p> : !list.length ? <p className="sub">还没有对话。把你整理好的对话发给我，我来放进来。</p> : list.map(d => (
          <button key={d.id} className="dlgcard" onClick={() => { setCur(d); setPeek(new Set()) }} data-testid={'dlg-' + d.id}>
            <i>{d.emoji}</i><div><b>{d.title}</b><span>{d.scene} · {d.items.filter(isLine).length} 句</span></div><em>›</em>
          </button>))}
        <p className="sub" style={{ margin: '16px 4px' }}>用法：点一句话听发音；右下角「🐢」慢速；可以遮住泰文只看中文，自己先说一遍再点开对答案。</p>
      </div>
    </div>)

  const lines = cur.items.filter(isLine)
  return (
    <div className="study dlgpage" role="dialog" aria-label={cur.title}>
      <div className="sthead"><button className="close" onClick={() => { tok.current++; stopAudio(); setAll(false); setPlaying(null); setCur(null) }}>‹ 对话</button><div className="prog"><b>{cur.emoji} {cur.title}</b></div><div className="cnt">{lines.length} 句</div></div>
      <div className="dlgtools">
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} data-testid="dlg-roman" /> 拼音</label>
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} data-testid="dlg-zh" /> 中文</label>
        <label><input type="checkbox" checked={hideTh} onChange={e => { setHideTh(e.target.checked); setPeek(new Set()) }} data-testid="dlg-hide" /> 遮住泰文（自测）</label>
      </div>
      <div className="chat" data-testid="chat">
        {cur.items.map((it, i) => isLine(it) ? (() => {
          const hidden = hideTh && !peek.has(it.n)
          return (
            <div key={i} ref={el => { if (el) refs.current.set(it.n, el); else refs.current.delete(it.n) }} className={'bub ' + (it.me ? 'me' : 'other') + (playing === it.n ? ' on' : '')} data-testid="bubble">
              <div className="who">{it.who}</div>
              <div className="bbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">点一下看泰文</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <ColorRoman roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              <div className="bplay">
                <button onClick={() => playOne(it)} aria-label="播放这一句" data-testid="bplay"><Speaker /></button>
                <button className="slow" onClick={() => playOne(it, true)} aria-label="慢速播放">🐢</button>
              </div>
            </div>)
        })() : <div key={i} className="dsec"><span>{it.sec}</span></div>)}
      </div>
      <div className="dlgbar"><button className={'nx' + (all ? ' stop' : '')} onClick={playAll} data-testid="dlg-playall">{all ? '⏹ 停止' : '▶ 连续播放整段对话'}</button></div>
    </div>)
}
