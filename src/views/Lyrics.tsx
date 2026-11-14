import { useEffect, useRef, useState } from 'react'
import { ColorRoman, Speaker } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'

interface Line { n: number; th: string; roman: string; zh: string; clip: string }
type Item = Line | { sec: string }
interface Song { id: string; title: string; intro: string; emoji: string; items: Item[] }
const isLine = (x: Item): x is Line => 'clip' in x

let cache: Promise<Song[]> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/lyrics.json`).then(r => r.ok ? r.json() : []).catch(() => { cache = null; return [] }))
const pref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem('thai30-lyr-' + k); return v === null ? d : JSON.parse(v) } catch { return d } }
const savePref = (k: string, v: unknown) => { try { localStorage.setItem('thai30-lyr-' + k, JSON.stringify(v)) } catch { /* 无痕模式 */ } }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 拼音按「｜」分成词组，一组一组看，更好断句背诵 */
function Chunks({ roman }: { roman: string }) {
  return <div className="lchunks">{roman.split('｜').map((c, i) => <ColorRoman key={i} roman={c.trim()} />)}</div>
}

/** 歌词背诵：整首歌一句一句看、听、遮住泰文自测，可以单句重复、整首循环。内容在 content/lyrics/*.txt。 */
export default function Lyrics({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Song[] | null>(null)
  const [cur, setCur] = useState<Song | null>(null)
  const [showRoman, setShowRoman] = useState(() => pref('roman', true))
  const [showZh, setShowZh] = useState(() => pref('zh', true))
  const [hideTh, setHideTh] = useState(() => pref('hideTh', false))
  const [hint, setHint] = useState(() => pref('hint', true))
  const [rep, setRep] = useState(() => pref('rep', 1))
  const [loop, setLoop] = useState(() => pref('loop', false))
  const [peek, setPeek] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const tok = useRef(0)
  const refs = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => { let on = true; load().then(d => on && setList(d)); return () => { on = false } }, [])
  useEffect(() => () => { tok.current++; stopAudio() }, [])
  useEffect(() => { savePref('roman', showRoman); savePref('zh', showZh); savePref('hideTh', hideTh); savePref('hint', hint); savePref('rep', rep); savePref('loop', loop) }, [showRoman, showZh, hideTh, hint, rep, loop])

  const say = async (l: Line, slow = false) => {
    setPlaying(l.n)
    try { await playFile(l.clip, slow) } catch { try { await playSystem(l.th, slow) } catch { /* 没有音频也没有系统语音 */ } }
  }
  const stop = () => { tok.current++; stopAudio(); setAll(false); setPlaying(null) }
  const playOne = (l: Line, slow = false) => { tok.current++; setAll(false); void say(l, slow).then(() => setPlaying(p => (p === l.n ? null : p))) }
  const playAll = () => {
    if (!cur) return
    if (all) return stop()
    const my = ++tok.current; setAll(true)
    const lines = cur.items.filter(isLine)
    void (async () => {
      do {
        for (const l of lines) {
          for (let r = 0; r < rep; r++) {
            if (tok.current !== my) return
            refs.current.get(l.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            await say(l)
            if (tok.current !== my) return
            await wait(r + 1 < rep ? 450 : 700)
          }
        }
      } while (loop && tok.current === my)
      if (tok.current === my) { setAll(false); setPlaying(null) }
    })()
  }

  if (!cur) return (
    <div className="study dlgpage" role="dialog" aria-label="歌词背诵">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>🎤 歌词背诵</b></div></div>
      <div className="dlglist">
        {!list ? <p className="sub">加载中…</p> : !list.length ? <p className="sub">还没有歌词。把整理好的歌词发给我，我来放进来。</p> : list.map(d => (
          <button key={d.id} className="dlgcard" onClick={() => setCur(d)} data-testid={'lyr-' + d.id}>
            <i>{d.emoji}</i><div><b>{d.title}</b><span>{d.intro} · {d.items.filter(isLine).length} 句</span></div><em>›</em>
          </button>))}
        <p className="sub" style={{ margin: '16px 4px' }}>用法：点一句听发音；先「遮住泰文」只看中文和开头提示，试着自己唱出来，再点一下看答案。整首可以单句重复 2–3 遍、循环播放。声音是合成语音朗读歌词，不是原唱旋律。</p>
      </div>
    </div>)

  const lines = cur.items.filter(isLine)
  return (
    <div className="study dlgpage" role="dialog" aria-label={cur.title}>
      <div className="sthead"><button className="close" onClick={() => { stop(); setCur(null) }}>‹ 歌词</button><div className="prog"><b>{cur.emoji} {cur.title}</b></div><div className="cnt">{lines.length} 句</div></div>
      <div className="dlgtools">
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} data-testid="lyr-roman" /> 拼音</label>
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} data-testid="lyr-zh" /> 中文</label>
        <label><input type="checkbox" checked={hideTh} onChange={e => { setHideTh(e.target.checked); setPeek(new Set()) }} data-testid="lyr-hide" /> 遮住泰文（背诵）</label>
        {hideTh && <label><input type="checkbox" checked={hint} onChange={e => setHint(e.target.checked)} data-testid="lyr-hint" /> 显示开头提示</label>}
      </div>
      <div className="dlgtools">
        <label>单句重复 <select value={rep} onChange={e => setRep(Number(e.target.value))} data-testid="lyr-rep"><option value={1}>1 遍</option><option value={2}>2 遍</option><option value={3}>3 遍</option></select></label>
        <label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} data-testid="lyr-loop" /> 整首循环</label>
      </div>
      <div className="chat lyrics" data-testid="lyr-lines">
        {cur.items.map((it, i) => isLine(it) ? (() => {
          const hidden = hideTh && !peek.has(it.n)
          const first = it.roman.split('｜')[0].trim()
          return (
            <div key={i} ref={el => { if (el) refs.current.set(it.n, el); else refs.current.delete(it.n) }} className={'lyr' + (playing === it.n ? ' on' : '')} data-testid="lyr-line">
              <b className="lno">{it.n}</b>
              <div className="lbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">{hint ? <>{first} …<small>（点一下看泰文）</small></> : '点一下看泰文'}</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <Chunks roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              <div className="bplay">
                <button onClick={() => playOne(it)} aria-label="播放这一句" data-testid="lyr-play"><Speaker /></button>
                <button className="slow" onClick={() => playOne(it, true)} aria-label="慢速播放">🐢</button>
              </div>
            </div>)
        })() : <div key={i} className="dsec"><span>{it.sec}</span></div>)}
      </div>
      <div className="dlgbar"><button className={'nx' + (all ? ' stop' : '')} onClick={playAll} data-testid="lyr-playall">{all ? '⏹ 停止' : `▶ 从头播放整首${rep > 1 ? `（每句 ${rep} 遍）` : ''}${loop ? ' · 循环' : ''}`}</button></div>
    </div>)
}
