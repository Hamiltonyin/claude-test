import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { ColorRoman, Speaker } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put, del } from '../lib/db'

interface Vowel { id: string; group: string; form: string; video: string; ipa: string; len: string; carrier: string; hint: string; ex: string[]; clip: [number, number]; pair: string | null }
interface Data { source: string; vowels: Vowel[] }

let cache: Promise<Data | null> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/vowels.json`).then(r => r.ok ? r.json() : null).catch(() => { cache = null; return null }))

/** 把泰文里的元音符号标成红色（上下标元音、前置元音、ะ า ำ อ 等），帮助把「字母 + 元音」拆开看。 */
const V_RE = /[ะ-ฺเ-ไ็ํฤ-ฦ]/
export function MarkVowels({ text }: { text: string }) {
  return <>{[...text].map((c, i) => V_RE.test(c) ? <span key={i} className="vmark">{c}</span> : <span key={i}>{c}</span>)}</>
}

/** 元音发音练习：每个元音配「机器合成的示范音节」，并且可以在本机导入老师的教学视频，点哪个元音就播放视频里对应的那一段。 */
export default function Vowels({ onClose }: { onClose: () => void }) {
  const { words, countPlay } = useApp()
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState<string[]>([])   // 最多同时展开 2 个，用来对比
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [ov, setOv] = useState<Record<string, [number, number]>>({})   // 你校准过的起止秒数（只存在本机）
  const [cal, setCal] = useState('')
  const [exPlaying, setExPlaying] = useState<string | null>(null)
  const [cmpBusy, setCmpBusy] = useState(false)
  const cmpTok = useRef(0)
  const [calOpen, setCalOpen] = useState<string | null>(null)   // 正在校准的元音（默认折叠）
  const vid = useRef<HTMLVideoElement>(null)
  const stopAt = useRef<number | null>(null)
  useEffect(() => { let on = true; load().then(d => on && setData(d)); return () => { on = false } }, [])
  useEffect(() => { get<Record<string, [number, number]>>('meta', 'vowelClips').then(o => o && setOv(o)).catch(() => {}) }, [])
  useEffect(() => { let u: string | null = null; get('meta', 'vowelVideo').then((b: unknown) => { if (b instanceof Blob) { u = URL.createObjectURL(b); setUrl(u) } }).catch(() => {}); return () => { if (u) URL.revokeObjectURL(u); stopAudio() } }, [])
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])

  const importVideo = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try { await put('meta', f, 'vowelVideo'); if (url) URL.revokeObjectURL(url); setUrl(URL.createObjectURL(f)) } finally { setBusy(false) }
  }
  const removeVideo = async () => { await del('meta', 'vowelVideo'); if (url) URL.revokeObjectURL(url); setUrl(null) }

  const sayTts = async (v: Vowel, slow: boolean) => {
    setPlaying(v.id)
    try { await playFile(`vow-${v.id}`, slow) } catch { try { await playSystem(v.carrier || v.form, slow) } catch { /* 没有语音 */ } }
    setPlaying(p => (p === v.id ? null : p))
  }
  const sayWord = async (w: { id: string; thai: string }, slow: boolean) => {
    countPlay(w.id); setExPlaying(w.thai)
    try { await playFile(w.id, slow) } catch { try { await playSystem(w.thai, slow) } catch { /* 没有语音 */ } }
    setExPlaying(p => (p === w.thai ? null : p))
  }
  const clipOf = (v: Vowel): [number, number] => ov[v.id] ?? v.clip
  const setClip = (v: Vowel, c: [number, number]) => {
    const n = { ...ov, [v.id]: [Math.max(0, +c[0].toFixed(2)), Math.max(0, +c[1].toFixed(2))] as [number, number] }
    setOv(n); void put('meta', n, 'vowelClips')
  }
  const resetClip = (v: Vowel) => { const n = { ...ov }; delete n[v.id]; setOv(n); void put('meta', n, 'vowelClips') }
  const exportClips = async () => {
    const all = Object.fromEntries((data?.vowels ?? []).map(v => [v.id, clipOf(v)]))
    const t = JSON.stringify(all)
    try { await navigator.clipboard.writeText(t); setCal('已复制全部时间轴，发给我就能固化进网站') } catch { setCal(t) }
  }
  const clipDone = useRef<(() => void) | null>(null)
  const finishClip = () => { const f = clipDone.current; clipDone.current = null; f?.() }
  const playClip = (v: Vowel): Promise<void> => {
    const el = vid.current; if (!el) return Promise.resolve()
    finishClip(); stopAudio(); setPlaying('clip-' + v.id)
    const [a, b] = clipOf(v)
    stopAt.current = b
    el.currentTime = a
    return new Promise<void>(res => { clipDone.current = res; el.play().catch(() => { setPlaying(null); finishClip() }) })
  }
  const onTime = () => {
    const el = vid.current
    if (el && stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; setPlaying(null); finishClip() }
  }
  const toggle = (id: string) => setOpen(o => o.includes(id) ? o.filter(x => x !== id) : [...o.slice(-1), id])
  const pair = open.map(id => data?.vowels.find(v => v.id === id)).filter((v): v is Vowel => !!v)
  const stopCmp = () => { cmpTok.current++; setCmpBusy(false); stopAudio(); const el = vid.current; if (el) el.pause(); stopAt.current = null; finishClip(); setPlaying(null) }
  /** 对比播放：A → B，连着听 2 轮（可选用示范音或老师视频）。 */
  const compare = async (mode: 'tts' | 'clip', slow = false) => {
    if (pair.length < 2) return
    const my = ++cmpTok.current; setCmpBusy(true)
    for (let r = 0; r < 2 && my === cmpTok.current; r++) {
      for (const v of pair) {
        if (my !== cmpTok.current) break
        if (mode === 'clip') await playClip(v); else await sayTts(v, slow)
        if (my !== cmpTok.current) break
        await new Promise(res => setTimeout(res, 350))
      }
    }
    if (my === cmpTok.current) setCmpBusy(false)
  }

  const groups = useMemo(() => {
    const m = new Map<string, Vowel[]>()
    for (const v of data?.vowels ?? []) m.set(v.group, [...(m.get(v.group) ?? []), v])
    return [...m.entries()]
  }, [data])

  return (
    <div className="study vowpage" role="dialog" aria-label="元音发音">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>🔤 元音发音练习</b></div><div className="cnt">{data?.vowels.length ?? 0} 个</div></div>
      <div className="vowlist">
        {url && <div className="vowvid">
            <video ref={vid} src={url} controls playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => setPlaying(null)} data-testid="vow-video" />
            <button className="link" onClick={removeVideo}>移除本机视频</button> <button className="link" onClick={() => void exportClips()} data-testid="vow-export">复制全部时间轴</button>
            {cal && <p className="sub" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{cal}</p>}
          </div>}
        <div className="vowintro">
          <b>怎么用</b>
          <p>可以同时展开两个元音（再点第三个会收起最早的那个），底部出现「对比」条，A→B 连着听两轮，比较区别。点元音卡片展开：先听「示范音」（合成语音），有视频的话再点「🎬 老师这一段」对照听。红色字母 = 元音；短音收得快，长音拉长约两倍。</p>
          {!url && <label className="vowimport">
            <input type="file" accept="video/*" onChange={e => void importVideo(e.target.files?.[0])} data-testid="vow-file" />
            <span>{busy ? '导入中…' : '📥 导入老师的教学视频（只存在你这台手机里，不会上传）'}</span>
          </label>}
          <p className="sub" style={{ fontSize: 11.5 }}>视频来源：TikTok @packpackgualuemjeen 的元音教学。别人的作品，不放在公开网站上；你把自己下载的视频导入一次，这里就会按秒数切段播放。</p>
        </div>
        {groups.map(([g, list]) => (
          <section key={g}>
            <h3 className="vowh">{g}</h3>
            {list.map(v => {
              const on = open.includes(v.id)
              return (
                <div key={v.id} className={'vowcard' + (on ? ' on' : '')} data-testid="vowel">
                  <button className="vowtop" onClick={() => toggle(v.id)}>
                    <span className="vowform th" lang="th">{v.form}</span>
                    <span className="vowmeta"><b>{v.video}</b><i>{v.len}</i></span>
                    <span className="vowipa">/{v.ipa}/</span>
                    <em>{on ? '⌃' : '⌄'}</em>
                  </button>
                  {on && <div className="vowbody">
                    <p className="vowhint">{v.hint}</p>
                    <div className="vowbtns">
                      <button onClick={() => void sayTts(v, false)} data-testid="vow-tts"><Speaker /> 示范音{v.carrier ? ` ${v.carrier}` : ''}</button>
                      <button onClick={() => void sayTts(v, true)}>🐢 慢速</button>
                      {url && <button className="clip" onClick={() => playClip(v)} data-testid="vow-clip">🎬 老师这一段{playing === 'clip-' + v.id ? '…' : ''}</button>}
                    </div>
                    {url && <button className="calbtn" onClick={() => setCalOpen(calOpen === v.id ? null : v.id)} data-testid="vow-calbtn">⚙ 校准时间轴{ov[v.id] ? '（已校准）' : ''} {calOpen === v.id ? '⌃' : '⌄'}</button>}
                    {url && calOpen === v.id && (() => { const [a, b] = clipOf(v); const cur = () => vid.current?.currentTime ?? 0; return (
                      <div className="vowcal" data-testid="vow-cal">
                        <div className="vowcalh">时间轴 <b data-testid="vow-range">{a.toFixed(2)}s – {b.toFixed(2)}s</b>{ov[v.id] && <button className="link" onClick={() => resetClip(v)}>还原</button>}</div>
                        <div className="vowcalr"><span>起点</span>
                          <button onClick={() => setClip(v, [a - 0.1, b])}>-0.1</button><button onClick={() => setClip(v, [a + 0.1, b])}>+0.1</button>
                          <button className="set" onClick={() => setClip(v, [cur(), b])} data-testid="vow-setstart">设为视频当前位置</button></div>
                        <div className="vowcalr"><span>终点</span>
                          <button onClick={() => setClip(v, [a, b - 0.1])}>-0.1</button><button onClick={() => setClip(v, [a, b + 0.1])}>+0.1</button>
                          <button className="set" onClick={() => setClip(v, [a, cur()])} data-testid="vow-setend">设为视频当前位置</button></div>
                        <p className="sub" style={{ fontSize: 11.5, margin: '4px 0 0' }}>做法：拖上面的视频到这个元音刚开始读的位置 → 点「起点·设为当前位置」；再拖到读完 → 点「终点」；然后点「🎬 老师这一段」试听。</p>
                      </div>) })()}
                    {v.ex.length > 0 && <div className="vowex">
                      {v.ex.map(t => { const w = byThai.get(t); return w ? (
                        <div key={t} className={'vowexrow' + (exPlaying === t ? ' on' : '')} role="button" tabIndex={0} onClick={() => void sayWord(w, false)} onKeyDown={e => { if (e.key === 'Enter') void sayWord(w, false) }} data-testid="vow-wplay">
                          <span className="th" lang="th"><MarkVowels text={w.thai} /></span>
                          <span className="vowexmid"><ColorRoman roman={w.roman} /><span className="z">{w.zh}</span></span>
                          <button className="wplay" onClick={e => { e.stopPropagation(); void sayWord(w, true) }} aria-label="慢速">🐢</button>
                          <span className="wspk" aria-hidden><Speaker /></span>
                        </div>) : null })}
                    </div>}
                  </div>}
                </div>)
            })}
          </section>))}
      </div>
      {pair.length === 2 && <div className="vowcmp" data-testid="vow-cmp">
        <b className="th" lang="th">{pair[0].form} ⇄ {pair[1].form}</b>
        {cmpBusy ? <button className="stop" onClick={stopCmp}>⏹ 停止</button> : <>
          <button onClick={() => void compare('tts')} data-testid="vow-cmp-tts"><Speaker /> 对比示范音</button>
          <button onClick={() => void compare('tts', true)}>🐢</button>
          {url && <button className="clip" onClick={() => void compare('clip')} data-testid="vow-cmp-clip">🎬 对比视频</button>}
        </>}
      </div>}
    </div>)
}
