import { useEffect, useRef, useState } from 'react'
import { ColorRoman, Speaker, VideoBar } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put, del } from '../lib/db'

interface Line { n: number; th: string; roman: string; zh: string; clip: string; t?: [number, number] }
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
  // —— 真人视频（只存本机）：每句起止秒，点 🎬 播放那一段；预设时间来自歌词文件，可以自己校准 ——
  const [vurl, setVurl] = useState<string | null>(null)
  const [vclips, setVclips] = useState<Record<string, [number, number]>>({})
  const [vidBig, setVidBig] = useState(true)
  const [calOpen, setCalOpen] = useState<number | null>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const stopAt = useRef<number | null>(null)
  const clipDone = useRef<(() => void) | null>(null)
  const curId = cur?.id
  useEffect(() => {
    if (!curId) return
    let u: string | null = null, ok = true
    setVurl(null); setCalOpen(null)
    const defs: Record<string, [number, number]> = {}
    for (const it of cur?.items ?? []) if (isLine(it) && it.t) defs[it.n] = it.t
    setVclips(defs)
    get('meta', 'lyrvideo:' + curId).then((b: unknown) => { if (ok && b instanceof Blob) { u = URL.createObjectURL(b); setVurl(u) } }).catch(() => {})
    get<Record<string, [number, number]>>('meta', 'lyrclips:' + curId).then(o => { if (ok && o) setVclips({ ...defs, ...o }) }).catch(() => {})
    return () => { ok = false; if (u) URL.revokeObjectURL(u) }
  }, [curId])
  const importVideo = async (f: File | undefined) => {
    if (!f || !curId) return
    try { await put('meta', f, 'lyrvideo:' + curId) } catch { /* 存不下也先能播这一次 */ }
    if (vurl) URL.revokeObjectURL(vurl); setVurl(URL.createObjectURL(f))
  }
  const removeVideo = async () => { if (!curId) return; await del('meta', 'lyrvideo:' + curId).catch(() => {}); if (vurl) URL.revokeObjectURL(vurl); setVurl(null) }
  const saveClip = (n: number, c: [number, number] | null) => {
    if (!curId) return
    const m = { ...vclips }; if (c) m[n] = [Math.max(0, +c[0].toFixed(2)), Math.max(0, +c[1].toFixed(2))]; else delete m[n]
    setVclips(m); void put('meta', m, 'lyrclips:' + curId)
  }
  const playClip = (l: Line, done?: () => void) => {
    const el = vid.current, c = vclips[l.n]; if (!el || !c) return
    if (!done) { tok.current++; setAll(false) }
    stopAudio(); setPlaying(l.n); clipDone.current = done ?? null
    stopAt.current = c[1]; el.currentTime = c[0]; void el.play().catch(() => { setPlaying(null); clipDone.current = null; done?.() })
  }
  const onTime = () => { const el = vid.current; if (el && stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; setPlaying(null); const d = clipDone.current; clipDone.current = null; d?.() } }
  const refs = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => { let on = true; load().then(d => on && setList(d)); return () => { on = false } }, [])
  useEffect(() => () => { tok.current++; stopAudio() }, [])
  useEffect(() => { savePref('roman', showRoman); savePref('zh', showZh); savePref('hideTh', hideTh); savePref('hint', hint); savePref('rep', rep); savePref('loop', loop) }, [showRoman, showZh, hideTh, hint, rep, loop])

  const say = async (l: Line, slow = false) => {
    setPlaying(l.n)
    try { await playFile(l.clip, slow) } catch { try { await playSystem(l.th, slow) } catch { /* 没有音频也没有系统语音 */ } }
  }
  const stop = () => { tok.current++; stopAudio(); vid.current?.pause(); setAll(false); setPlaying(null) }
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
            if (vurl && vclips[l.n]) { await new Promise<void>(r => { playClip(l, r); setTimeout(r, ((vclips[l.n][1] - vclips[l.n][0]) + 3) * 1000) }) } else await say(l)
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
      <div className="sthead"><button className="close" onClick={() => { stop(); setCur(null) }}>‹ 歌词</button><div className="prog"><b>{cur.emoji} {cur.title}</b></div>{!vurl && <label className="gdot" aria-label="导入真人视频" title="导入真人视频">📥<input type="file" accept="video/*,audio/*" hidden onChange={e => void importVideo(e.target.files?.[0])} data-testid="lyr-vfile" /></label>}{vurl && <button className="gdot" onClick={() => void removeVideo()} aria-label="移除视频" title="移除视频">🗑</button>}</div>
      {vurl && <div className={'vowvid' + (vidBig ? '' : ' min')}>
        <video ref={vid} src={vurl} playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => { setPlaying(null); const d = clipDone.current; clipDone.current = null; d?.() }} onClick={() => { const el = vid.current; if (el) { if (el.paused) void el.play().catch(() => {}); else el.pause() } }} data-testid="lyr-video" />
        <VideoBar vid={vid} big={vidBig} onSize={() => setVidBig(!vidBig)} />
      </div>}
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
              <div className="lbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : (vurl && vclips[it.n]) ? playClip(it) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">{hint ? <>{first} …<small>（点一下看泰文）</small></> : '点一下看泰文'}</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <Chunks roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              <div className="bplay">
                {vurl && <button className={'real' + (vclips[it.n] ? ' has' : '')} disabled={!vclips[it.n]} onClick={() => playClip(it)} aria-label="播放真人" data-testid="lyr-vclip">🎬{vclips[it.n] ? <small>{vclips[it.n][0].toFixed(1)}–{vclips[it.n][1].toFixed(1)}s</small> : <small>未设</small>}</button>}
                <button className={vurl && vclips[it.n] ? 'robot' : ''} onClick={() => playOne(it)} aria-label="播放这一句" data-testid="lyr-play">{vurl && vclips[it.n] ? '🤖' : <Speaker />}</button>
                {!(vurl && vclips[it.n]) && <button className="slow" onClick={() => playOne(it, true)} aria-label="慢速播放">🐢</button>}
                {vurl && <button className="more" onClick={() => setCalOpen(calOpen === it.n ? null : it.n)} aria-label="校准时间" data-testid="lyr-calbtn">⏱</button>}
              </div>
              {vurl && calOpen === it.n && (() => { const c = vclips[it.n]; const cur0 = () => vid.current?.currentTime ?? 0; const [a, b] = c ?? [0, 0]; return (
                <div className="vowcal" data-testid="lyr-cal">
                  <div className="vowcalh">时间轴 <b>{c ? `${a.toFixed(2)}s – ${b.toFixed(2)}s` : '未设置'}</b>{c && <button className="link" onClick={() => saveClip(it.n, null)}>清除</button>}</div>
                  <div className="vowcalr"><span>起点</span><button onClick={() => saveClip(it.n, [a - 0.1, b])}>-0.1</button><button onClick={() => saveClip(it.n, [a + 0.1, b])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [cur0(), c ? Math.max(b, cur0() + 0.8) : cur0() + 1.5])}>设为视频当前位置</button></div>
                  <div className="vowcalr"><span>终点</span><button onClick={() => saveClip(it.n, [a, b - 0.1])}>-0.1</button><button onClick={() => saveClip(it.n, [a, b + 0.1])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [a, cur0()])}>设为视频当前位置</button></div>
                </div>) })()}
            </div>)
        })() : <div key={i} className="dsec"><span>{it.sec}</span></div>)}
      </div>
      <div className="dlgbar"><button className={'nx' + (all ? ' stop' : '')} onClick={playAll} data-testid="lyr-playall">{all ? '⏹ 停止' : `▶ 从头播放整首${rep > 1 ? `（每句 ${rep} 遍）` : ''}${loop ? ' · 循环' : ''}`}</button></div>
    </div>)
}
