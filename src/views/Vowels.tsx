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
  const { words } = useApp()
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [ov, setOv] = useState<Record<string, [number, number]>>({})   // 你校准过的起止秒数（只存在本机）
  const [cal, setCal] = useState('')
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
  const playClip = (v: Vowel) => {
    const el = vid.current; if (!el) return
    stopAudio(); setPlaying('clip-' + v.id)
    const [a, b] = clipOf(v)
    stopAt.current = b
    el.currentTime = a
    void el.play().catch(() => setPlaying(null))
  }
  const onTime = () => {
    const el = vid.current
    if (el && stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; setPlaying(null) }
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
        <div className="vowintro">
          <b>怎么用</b>
          <p>点元音卡片展开：先听「示范音」（合成语音），有视频的话再点「🎬 老师这一段」对照听。红色字母 = 元音；短音收得快，长音拉长约两倍。</p>
          {url ? <div className="vowvid">
            <video ref={vid} src={url} controls playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => setPlaying(null)} data-testid="vow-video" />
            <button className="link" onClick={removeVideo}>移除本机视频</button> <button className="link" onClick={() => void exportClips()} data-testid="vow-export">复制全部时间轴</button>
            {cal && <p className="sub" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{cal}</p>}
          </div> : <label className="vowimport">
            <input type="file" accept="video/*" onChange={e => void importVideo(e.target.files?.[0])} data-testid="vow-file" />
            <span>{busy ? '导入中…' : '📥 导入老师的教学视频（只存在你这台手机里，不会上传）'}</span>
          </label>}
          <p className="sub" style={{ fontSize: 11.5 }}>视频来源：TikTok @packpackgualuemjeen 的元音教学。别人的作品，不放在公开网站上；你把自己下载的视频导入一次，这里就会按秒数切段播放。</p>
        </div>
        {groups.map(([g, list]) => (
          <section key={g}>
            <h3 className="vowh">{g}</h3>
            {list.map(v => {
              const on = open === v.id
              return (
                <div key={v.id} className={'vowcard' + (on ? ' on' : '')} data-testid="vowel">
                  <button className="vowtop" onClick={() => setOpen(on ? null : v.id)}>
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
                    {url && (() => { const [a, b] = clipOf(v); const cur = () => vid.current?.currentTime ?? 0; return (
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
                        <div key={t} className="vowexrow"><span className="th" lang="th"><MarkVowels text={w.thai} /></span><ColorRoman roman={w.roman} /><span className="z">{w.zh}</span></div>) : null })}
                    </div>}
                  </div>}
                </div>)
            })}
          </section>))}
      </div>
    </div>)
}
