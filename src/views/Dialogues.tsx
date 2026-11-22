import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ColorRoman, Speaker, TapRoman, VideoBar, VowelInfoCard } from '../ui'
import { lookupSyllable } from '../lib/vowelLookup'
import { playFile, playSystem, prefetchAudio, stopAudio } from '../lib/audio'
import { get, put, del } from '../lib/db'

interface Line { n: number; who?: string; me?: boolean; th: string; roman: string; zh: string; clip: string; t?: [number, number] }
type Item = Line | { sec: string }
interface Edit { th?: string; roman?: string; zh?: string }
interface Dlg { id: string; title: string; scene?: string; intro?: string; emoji: string; items: Item[] }
export type Kind = 'dlg' | 'lyr'
const SRC: Record<Kind, string> = { dlg: 'dialogues.json', lyr: 'lyrics.json' }
const T = { dlg: { name: '情景对话', noun: '对话', empty: '还没有对话。把你整理好的对话发给我，我来放进来。', all: '连续播放整段对话' }, lyr: { name: '🎤 歌词背诵', noun: '歌词', empty: '还没有歌词。把整理好的歌词发给我，我来放进来。', all: '从头播放整首' } } as const
// 透镜效果：离中间越近越大、越清楚；越远越小、越淡，而且往中间挤（像鱼眼/放大镜）。off＝这一句离中间的格数（可带小数，随手指连续变化）
const lens = (off: number, cap = 9): React.CSSProperties => {   // cap：这一句最大能放大到几倍（长句子放大后会超出中间的毛玻璃框，就少放大一点）
  const a = Math.abs(off), A = 1.75
  const g = Math.sign(off) * A * Math.tanh(a / A)                       // 压缩后的位置：近处基本不变，远处越来越挤
  const sc = Math.min(cap, 0.42 + 0.86 * Math.exp(-(off * off) / 1.5))  // 中间 1.28 倍 → 相邻 ≈0.85 → 再远 ≈0.5
  const op = 0.22 + 0.78 * Math.exp(-(off * off) / 2.6)
  return { opacity: op, filter: a < 0.55 ? undefined : `blur(${Math.min(1.8, (a - 0.55) * 1.1).toFixed(1)}px)`, transform: `perspective(700px) translateY(${((g - off) * WH).toFixed(1)}px) rotateX(${Math.max(-60, Math.min(60, -off * 16)).toFixed(1)}deg) scale(${sc.toFixed(3)})` }
}
const WH = 150   // 滚轴每一句的高度（px）
const isLine = (x: Item): x is Line => 'clip' in x

const caches: Partial<Record<Kind, Promise<Dlg[]>>> = {}
const load = (k: Kind) => (caches[k] ??= fetch(`${import.meta.env.BASE_URL}content/${SRC[k]}`).then(r => r.ok ? r.json() : []).catch(() => { delete caches[k]; return [] }))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
/** 歌词的拼音按「｜」分成词组，一组一组看，更好断句背诵 */
function Chunks({ roman }: { roman: string }) { return <div className="lchunks">{roman.split('｜').map((c, i) => <ColorRoman key={i} roman={c.trim()} />)}</div> }

const pref = <V,>(K: string, k: string, d: V): V => { try { const v = localStorage.getItem('thai30-' + K + '-' + k); return v === null ? d : JSON.parse(v) } catch { return d } }
const savePref = (K: string, k: string, v: unknown) => { try { localStorage.setItem('thai30-' + K + '-' + k, JSON.stringify(v)) } catch { /* 无痕模式 */ } }

/** 情景对话：像聊天记录一样一句一句看、一句一句听；可以只看中文遮住泰文自测。对话内容在 content/dialogues/*.txt。 */
export default function Dialogues({ onClose, kind = 'dlg' }: { onClose: () => void; kind?: Kind }) {
  const K = kind, tp = kind, tx = T[kind]
  const Rom = ({ roman }: { roman: string }) => K === 'lyr' ? <Chunks roman={roman} /> : <ColorRoman roman={roman} />
  // 滚轴中间那句的拼音可以点：点一个音节，下方显示它的元音（泰文怎么写、长短、尾辅音）
  const [vq, setVq] = useState<ReturnType<typeof lookupSyllable>>(null)
  const TapRom = ({ roman }: { roman: string }) => K === 'lyr'
    ? <div className="lchunks">{roman.split('｜').map((c, i) => <TapRoman key={i} roman={c.trim()} onTap={syl => setVq(lookupSyllable(syl))} />)}</div>
    : <TapRoman roman={roman} onTap={syl => setVq(lookupSyllable(syl))} />
  const [list, setList] = useState<Dlg[] | null>(null)
  const [cur, setCur] = useState<Dlg | null>(null)
  const [showRoman, setShowRoman] = useState(() => pref(K, 'roman', true))
  const [showZh, setShowZh] = useState(() => pref(K, 'zh', true))
  const [hideTh, setHideTh] = useState(() => pref(K, 'hideTh', false))
  const [hint, setHint] = useState(() => pref(K, 'hint', true))
  const [rep, setRep] = useState(() => pref(K, 'rep', 1))
  const [loop, setLoop] = useState(() => pref(K, 'loop', false))
  const [act, setAct] = useState<boolean>(() => pref(K, 'act', false))   // 小图标（播放/慢速/修改/校准…）默认藏起来
  const [mode, setMode] = useState<'chat' | 'wheel'>(() => pref(K, 'mode', 'wheel'))
  const [pos, setPos] = useState(0)                     // 滚轴当前位置（第几句，带小数）
  const selN = Math.round(pos)
  useEffect(() => { setVq(null) }, [selN, cur?.id])   // 滑到别的句子：收起元音卡
  const wheel = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  // 每一句内容的实际高度 → 放大到中间时最多放大多少倍，保证整句都在毛玻璃框（高 150px）里
  const wics = useRef(new Map<number, HTMLDivElement>())
  const [fit, setFit] = useState<Record<number, number>>({})
  const [peek, setPeek] = useState<Set<number>>(new Set())      // 遮住泰文时，点开看的那几句
  const [playing, setPlaying] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const tok = useRef(0)
  const refs = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => { let on = true; load(K).then(d => on && setList(d)); return () => { on = false } }, [])
  useEffect(() => () => { tok.current++; stopAudio() }, [])
  useLayoutEffect(() => {
    if (mode !== 'wheel') return
    const f: Record<number, number> = {}
    for (const [n, el] of wics.current) {
      const kids = [...el.children] as HTMLElement[]; if (!kids.length) continue
      const h = kids[kids.length - 1].offsetTop + kids[kids.length - 1].offsetHeight - kids[0].offsetTop   // 不受缩放影响的原始高度
      f[n] = Math.max(0.6, Math.min(1.28, (WH - 12) / Math.max(1, h)))
    }
    setFit(old => JSON.stringify(old) === JSON.stringify(f) ? old : f)
  })
  useEffect(() => { savePref(K, 'roman', showRoman); savePref(K, 'zh', showZh); savePref(K, 'hideTh', hideTh); savePref(K, 'mode', mode); savePref(K, 'act', act); savePref(K, 'hint', hint); savePref(K, 'rep', rep); savePref(K, 'loop', loop) }, [showRoman, showZh, hideTh, mode, act, hint, rep, loop])

  // —— 真人视频：每段对话可以导入一个自己的视频（只存本机），再给每一句设起止秒数，点 🎬 就播放那一段 ——
  const [vurl, setVurl] = useState<string | null>(null)
  const [vclips, setVclips] = useState<Record<string, [number, number]>>({})
  const [calOpen, setCalOpen] = useState<number | null>(null)
  const [setOpen, setSetOpen] = useState(false)          // 设置面板（拼音/中文/遮住/视频管理）
  const [vidBig, setVidBig] = useState(true)             // 视频：默认大画面（YouTube 样式），可缩成小缩略图
  const [editOpen, setEditOpen] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<string, Edit>>({})   // 我改过的文字（只存本机）：泰文/拼音/中文
  const [draft, setDraft] = useState<Edit>({})
  const [vmsg, setVmsg] = useState('')
  const vid = useRef<HTMLVideoElement>(null)
  const stopAt = useRef<number | null>(null)
  const clipDone = useRef<(() => void) | null>(null)
  const curId = cur?.id
  useEffect(() => {
    if (!curId) return
    let u: string | null = null, ok = true
    setVurl(null); setVclips({}); setCalOpen(null); setEditOpen(null); setEdits({}); setVmsg('')
    setPos(0); if (wheel.current) wheel.current.scrollTop = 0   // 换一首/一段时滚轴回到第一句
    get('meta', K + 'video:' + curId).then((b: unknown) => { if (ok && b instanceof Blob) { u = URL.createObjectURL(b); setVurl(u) } }).catch(() => {})
    const defs: Record<string, [number, number]> = {}   // 内容里预先记录好的起止秒（按原视频），自己调过的优先
    for (const it of cur?.items ?? []) if (isLine(it) && it.t) defs[it.n] = it.t
    setVclips(defs)
    get<Record<string, Edit>>('meta', K + 'edit:' + curId).then(o => { if (ok && o) setEdits(o) }).catch(() => {})
    get<Record<string, [number, number]>>('meta', K + 'clips:' + curId).then(o => { if (ok && o) setVclips({ ...defs, ...o }) }).catch(() => {})
    return () => { ok = false; if (u) URL.revokeObjectURL(u) }
  }, [curId])
  const importVideo = async (f: File | undefined) => {
    if (!f || !curId) return
    try { await put('meta', f, K + 'video:' + curId) } catch { /* 存不下也先能播这一次 */ }
    if (vurl) URL.revokeObjectURL(vurl); setVurl(URL.createObjectURL(f))
  }
  const removeVideo = async () => { if (!curId) return; await del('meta', K + 'video:' + curId).catch(() => {}); if (vurl) URL.revokeObjectURL(vurl); setVurl(null) }
  const saveClip = (n: number, c: [number, number] | null) => {
    if (!curId) return
    const m = { ...vclips }; if (c) m[n] = [Math.max(0, +c[0].toFixed(2)), Math.max(0, +c[1].toFixed(2))]; else delete m[n]
    setVclips(m); void put('meta', m, K + 'clips:' + curId)
  }
  const eff = (l: Line): Line => { const e = edits[l.n]; return e ? { ...l, th: e.th ?? l.th, roman: e.roman ?? l.roman, zh: e.zh ?? l.zh } : l }
  const saveEdit = (l: Line, e: Edit | null) => {
    if (!curId) return
    const m = { ...edits }
    const clean: Edit = {}
    if (e) { if (e.th?.trim() && e.th.trim() !== l.th) clean.th = e.th.trim(); if (e.roman?.trim() && e.roman.trim() !== l.roman) clean.roman = e.roman.trim(); if (e.zh?.trim() && e.zh.trim() !== l.zh) clean.zh = e.zh.trim() }
    if (Object.keys(clean).length) m[l.n] = clean; else delete m[l.n]
    setEdits(m); void put('meta', m, K + 'edit:' + curId); setEditOpen(null)
  }
  const playClip = (l: Line, done?: () => void) => {
    const el = vid.current, c = vclips[l.n]; if (!el || !c) return
    if (!done) { tok.current++; setAll(false) }
    stopAudio(); setPlaying(l.n); clipDone.current = done ?? null
    stopAt.current = c[1]; el.currentTime = c[0]; void el.play().catch(() => { setPlaying(null); clipDone.current = null; done?.() })
  }
  const onTime = () => { const el = vid.current; if (el && stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; setPlaying(null); const d = clipDone.current; clipDone.current = null; d?.() } }
  const exportClips = async () => { const t = JSON.stringify({ id: curId, clips: vclips, edits }); try { await navigator.clipboard.writeText(t); setVmsg('已复制这段对话的全部时间轴，发给我就能固化进网站') } catch { setVmsg(t) } }

  const say = async (l0: Line, slow = false) => {
    const l = eff(l0); setPlaying(l.n)
    if (edits[l.n]?.th) { try { await playSystem(l.th, slow) } catch { /* 没有系统语音 */ } return }   // 改过泰文：原来的录音不再对应，改用系统语音读新泰文
    try { await playFile(l.clip, slow) } catch { try { await playSystem(l.th, slow) } catch { /* 没有音频也没有系统语音 */ } }
  }
  const playOne = (l: Line, slow = false) => { tok.current++; setAll(false); void say(l, slow).then(() => setPlaying(p => (p === l.n ? null : p))) }
  // 滚轴滑到第 k 句：自己做 220ms 的缓动（临时关掉吸附，避免和吸附打架），这样自动播放时滚动的时刻是可预期的
  const anim = useRef(0)
  const GLIDE = 0.22
  const glide = (k: number, ms = GLIDE * 1000) => {
    const el = wheel.current; if (!el) return
    cancelAnimationFrame(anim.current)
    const from = el.scrollTop, to = k * WH; if (Math.abs(to - from) < 1) return
    el.style.scrollSnapType = 'none'
    const t0 = performance.now()
    const step = (t: number) => { const p = Math.min(1, (t - t0) / ms); el.scrollTop = from + (to - from) * (1 - Math.pow(1 - p, 3)); if (p < 1) anim.current = requestAnimationFrame(step); else el.style.scrollSnapType = '' }
    anim.current = requestAnimationFrame(step)
  }
  const stopAll = () => { tok.current++; cancelAnimationFrame(anim.current); if (wheel.current) wheel.current.style.scrollSnapType = ''; stopAudio(); vid.current?.pause(); setAll(false); setPlaying(null) }
  const playAll = () => {
    if (!cur) return
    if (all) return stopAll()
    const my = ++tok.current; setAll(true)
    const lines = cur.items.filter(isLine)
    const reps = K === 'lyr' ? rep : 1
    const show = (l: Line) => { setPlaying(l.n); if (mode === 'wheel') glide(lines.indexOf(l)); else refs.current.get(l.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
    const clipLines = lines.filter(l => vurl && vclips[l.n]).sort((a, b) => vclips[a.n][0] - vclips[b.n][0])
    const useVideo = !!vurl && reps === 1 && clipLines.length >= Math.ceil(lines.length * 0.6)
    void (async () => {
      if (useVideo) {
        // 视频连续播放：视频一直往下走（不停顿），每一句「开始前 0.22 秒」滚轴开始滑，到这句开始时刚好停在中间
        const el = vid.current!; stopAudio(); stopAt.current = null; clipDone.current = null
        const first = clipLines[0], endT = Math.max(...clipLines.map(l => vclips[l.n][1]))
        do {
          el.currentTime = vclips[first.n][0]; await el.play().catch(() => {})
          let idx = -1
          await new Promise<void>(res => {
            const tick = () => {
              if (tok.current !== my) return res()
              const t = el.currentTime; let k = idx
              while (k + 1 < clipLines.length && t >= vclips[clipLines[k + 1].n][0] - GLIDE) k++
              if (k !== idx) { idx = k; show(clipLines[k]) }
              if (t >= endT || el.ended) return res()
              requestAnimationFrame(tick)
            }
            tick()
          })
          el.pause()
        } while (K === 'lyr' && loop && tok.current === my)
      } else {
        prefetchAudio(lines.map(l => l.clip))
        do {
          for (const l of lines) {
            for (let r = 0; r < reps; r++) {
              if (tok.current !== my) return
              show(l)
              if (vurl && vclips[l.n]) { await new Promise<void>(res => { playClip(l, res); setTimeout(res, ((vclips[l.n][1] - vclips[l.n][0]) + 3) * 1000) }) } else await say(l)
            }
          }
        } while (K === 'lyr' && loop && tok.current === my)
      }
      if (tok.current === my) { setAll(false); setPlaying(null) }
    })()
  }

  if (!cur) return (
    <div className="study dlgpage" role="dialog" aria-label={tx.name}>
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>{tx.name}</b></div></div>
      <div className="dlglist">
        {!list ? <p className="sub">加载中…</p> : !list.length ? <p className="sub">{tx.empty}</p> : list.map(d => (
          <button key={d.id} className="dlgcard" onClick={() => { setCur(d); setPeek(new Set()) }} data-testid={tp + '-' + d.id}>
            <i>{d.emoji}</i><div><b>{d.title}</b><span>{d.scene ?? d.intro} · {d.items.filter(isLine).length} 句</span></div><em>›</em>
          </button>))}
      </div>
    </div>)

  // 每一句下面的操作：播放真人/电子音、改文字、校准时间（聊天视图和滚轴视图共用）
  const actions = (it0: Line) => {
    const it = eff(it0), edited = !!edits[it0.n], real = !!(vurl && vclips[it.n])
    if (!act) return null
    return (<>
              <div className="bplay">
                {vurl && <button className={'real' + (vclips[it.n] ? ' has' : '')} disabled={!vclips[it.n]} onClick={() => playClip(it)} aria-label="播放真人" data-testid={tp + '-vclip'}>🎬{vclips[it.n] ? <small>{vclips[it.n][0].toFixed(1)}–{vclips[it.n][1].toFixed(1)}s</small> : <small>未设</small>}</button>}
                <button className={real ? 'robot' : ''} onClick={() => playOne(it)} aria-label={real ? '电子语音' : '播放这一句'} data-testid={K === 'lyr' ? 'lyr-play' : 'bplay'}>{real ? '🤖' : <Speaker />}</button>
                {!real && <button className="slow" onClick={() => playOne(it, true)} aria-label="慢速播放">🐢</button>}
                <button className="more" onClick={() => { setEditOpen(editOpen === it.n ? null : it.n); setCalOpen(null); setDraft({ th: it.th, roman: it.roman, zh: it.zh }) }} aria-label="修改文字" data-testid={tp + '-editbtn'}>✏️</button>
                {vurl && <button className="more" onClick={() => { setCalOpen(calOpen === it.n ? null : it.n); setEditOpen(null) }} aria-label="校准时间" data-testid={tp + '-calbtn'}>⏱</button>}
              </div>
              {editOpen === it.n && (
                <div className="dlgedit" data-testid={tp + '-edit'}>
                  <label>泰文<input value={draft.th ?? ''} onChange={e => setDraft({ ...draft, th: e.target.value })} lang="th" data-testid={tp + '-edit-th'} /></label>
                  <label>拼音<input value={draft.roman ?? ''} onChange={e => setDraft({ ...draft, roman: e.target.value })} data-testid={tp + '-edit-roman'} /></label>
                  <label>中文<input value={draft.zh ?? ''} onChange={e => setDraft({ ...draft, zh: e.target.value })} data-testid={tp + '-edit-zh'} /></label>
                  <div className="dlgeditbtn"><button className="save" onClick={() => saveEdit(it0, draft)} data-testid={tp + '-edit-save'}>保存</button>{edited && <button onClick={() => saveEdit(it0, null)} data-testid={tp + '-edit-reset'}>恢复原文</button>}<button onClick={() => setEditOpen(null)}>取消</button></div>
                </div>)}
              {vurl && calOpen === it.n && (() => { const c = vclips[it.n]; const cur0 = () => vid.current?.currentTime ?? 0; const [a, b] = c ?? [0, 0]; return (
                <div className="vowcal" data-testid={tp + '-cal'}>
                  <div className="vowcalh">时间轴 <b data-testid={tp + '-range'}>{c ? `${a.toFixed(2)}s – ${b.toFixed(2)}s` : '未设置'}</b>{c && <button className="link" onClick={() => saveClip(it.n, null)}>清除</button>}</div>
                  <div className="vowcalr"><span>起点</span><button onClick={() => saveClip(it.n, [a - 0.1, b])}>-0.1</button><button onClick={() => saveClip(it.n, [a + 0.1, b])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [cur0(), c ? Math.max(b, cur0() + 0.8) : cur0() + 1.5])} data-testid={tp + '-setstart'}>设为视频当前位置</button></div>
                  <div className="vowcalr"><span>终点</span><button onClick={() => saveClip(it.n, [a, b - 0.1])}>-0.1</button><button onClick={() => saveClip(it.n, [a, b + 0.1])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [a, cur0()])} data-testid={tp + '-setend'}>设为视频当前位置</button></div>
                </div>) })()}
    </>)
  }

  const mask = (l: Line) => K === 'lyr' && hint ? <>{l.roman.split('｜')[0].trim()} …<small>（点一下看泰文）</small></> : '点一下看泰文'
  const lines = cur.items.filter(isLine)
  const secOf = new Map<number, string>(); { let sec = ''; for (const x of cur.items) { if (isLine(x)) secOf.set(x.n, sec); else sec = x.sec } }
  const sel = Math.max(0, Math.min(lines.length - 1, Math.round(pos)))
  const selLine = lines[sel] ? eff(lines[sel]) : null
  const selHidden = !!selLine && hideTh && !peek.has(selLine.n)
  const selReal = !!(selLine && vurl && vclips[selLine.n])
  const wheelTo = (k: number) => wheel.current?.scrollTo({ top: k * WH, behavior: 'smooth' })
  return (
    <div className="study dlgpage" role="dialog" aria-label={cur.title}>
      <div className="sthead">
        <button className="close" onClick={() => { stopAll(); setCur(null) }}>‹</button>
        <div className="prog"><b className="dtitle">{cur.emoji} {cur.title.replace(/（[^）]*）/g, '')}</b></div>
        {!vurl && <label className="gdot wide" aria-label="导入真人视频" title="导入真人视频">📥 导入视频<input type="file" accept="video/*,audio/*" hidden onChange={e => void importVideo(e.target.files?.[0])} data-testid={tp + '-vfile'} /></label>}
        <button className={'gdot' + (act ? ' on' : '')} onClick={() => setAct(!act)} aria-label="显示/隐藏操作图标" data-testid={tp + '-act'}>⋯</button>
        <button className={'gdot' + (setOpen ? ' on' : '')} onClick={() => setSetOpen(!setOpen)} aria-label="设置" data-testid={tp + '-settings'}>⚙</button>
      </div>
      {setOpen && <div className="gpop" data-testid={tp + '-setpanel'}>
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} data-testid={tp + '-roman'} /> 拼音</label>
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} data-testid={tp + '-zh'} /> 中文</label>
        <label><input type="checkbox" checked={hideTh} onChange={e => { setHideTh(e.target.checked); setPeek(new Set()) }} data-testid={tp + '-hide'} /> 遮住泰文</label>
        {K === 'lyr' && hideTh && <label><input type="checkbox" checked={hint} onChange={e => setHint(e.target.checked)} data-testid="lyr-hint" /> 开头提示</label>}
        {K === 'lyr' && <label>单句 <select value={rep} onChange={e => setRep(Number(e.target.value))} data-testid="lyr-rep"><option value={1}>1 遍</option><option value={2}>2 遍</option><option value={3}>3 遍</option></select></label>}
        {K === 'lyr' && <label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} data-testid="lyr-loop" /> 循环</label>}
        <button className="link" onClick={() => setMode(mode === 'wheel' ? 'chat' : 'wheel')} data-testid={tp + '-mode-toggle'}>{mode === 'wheel' ? '切到列表' : '切到滚轴'}</button>
        {vurl && <><button className="link" onClick={() => void exportClips()}>复制时间轴</button><button className="link" onClick={() => void removeVideo()}>移除视频</button></>}
        {vmsg && <p className="sub" style={{ fontSize: 11, wordBreak: 'break-all', flexBasis: '100%' }}>{vmsg}</p>}
      </div>}
      {vurl && <div className={'vowvid' + (vidBig ? '' : ' min')}>
        <video ref={vid} src={vurl} playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => { setPlaying(null); const d = clipDone.current; clipDone.current = null; d?.() }} onClick={() => { const el = vid.current; if (el) { if (el.paused) void el.play().catch(() => {}); else el.pause() } }} data-testid={tp + '-video'} />
        <VideoBar vid={vid} big={vidBig} onSize={() => setVidBig(!vidBig)} />
      </div>}
      {mode === 'wheel' ? (
        <div className="wheelpage" data-testid="wheelpage">
          <div className="wheelwrap">
            <div className="wheelband" />
            <div className="wglass top" /><div className="wglass bot" />
            <div className="wheel" ref={wheel} data-testid="wheel" onScroll={e => { const t = e.currentTarget.scrollTop; cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setPos(t / WH)) }}>
              <div className="wspacer" />
              {lines.map((l0, k) => {
                const l = eff(l0), off = k - pos, ad = Math.abs(off)
                const hidden = hideTh && !peek.has(l.n)
                return (
                  <div key={l.n} className={'wi' + (k === sel ? ' on' : '') + (playing === l.n ? ' playing' : '')} data-testid="wheel-item" style={{ height: WH }}
                    onClick={() => { if (k !== sel) wheelTo(k); else if (hidden) setPeek(new Set(peek).add(l.n)); else if (vurl && vclips[l.n]) playClip(l); else playOne(l) }}>
                    <div className="wic" style={lens(off, fit[l.n])} ref={el => { if (el) wics.current.set(l.n, el); else wics.current.delete(l.n) }}>
                    {secOf.get(l.n) && <div className="wsec">{secOf.get(l.n)}</div>}
                    {hidden ? <div className="th masked" lang="th">{mask(l)}</div> : <div className={"th" + (l.th.length > 16 ? " long" : "")} lang="th">{l.th}</div>}
                    {showRoman && !hidden && (k === sel ? <TapRom roman={l.roman} /> : <Rom roman={l.roman} />)}
                    {showZh && <div className="dz">{l.zh}</div>}
                    </div>
                  </div>)
              })}
              <div className="wspacer" />
            </div>
          </div>
          <div className="wheelfoot">
            {vq && <VowelInfoCard q={vq} onClose={() => setVq(null)} />}
            <div className="wnav">{act && <button className="gdot" onClick={() => wheelTo(Math.max(0, sel - 1))} disabled={sel <= 0} aria-label="上一句" data-testid="wheel-prev">▲</button>}<span className="wcount" data-testid="wheel-count">{sel + 1} / {lines.length}{selLine && edits[selLine.n] && <em className="edtag" data-testid={tp + '-edited'}> · 已改</em>}</span>{act && <button className="gdot" onClick={() => wheelTo(Math.min(lines.length - 1, sel + 1))} disabled={sel >= lines.length - 1} aria-label="下一句" data-testid="wheel-next">▼</button>}</div>
            {lines[sel] && <div className="wactions">{actions(lines[sel])}</div>}
          </div>
        </div>
      ) : (
      <div className={'chat' + (K === 'lyr' ? ' lyrics' : '')} data-testid={K === 'lyr' ? 'lyr-lines' : 'chat'}>
        {cur.items.map((it0, i) => isLine(it0) ? (() => {
          const it = eff(it0), edited = !!edits[it0.n], real = !!(vurl && vclips[it.n])
          const hidden = hideTh && !peek.has(it.n)
          return (
            K === 'lyr' ? (
            <div key={i} ref={el => { if (el) refs.current.set(it.n, el); else refs.current.delete(it.n) }} className={'lyr' + (playing === it.n ? ' on' : '')} data-testid="lyr-line">
              <b className="lno">{it.n}</b>
              <div className="lbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : real ? playClip(it) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">{mask(it)}</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <Rom roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              {actions(it0)}
            </div>) :
            <div key={i} ref={el => { if (el) refs.current.set(it.n, el); else refs.current.delete(it.n) }} className={'bub ' + (it.me ? 'me' : 'other') + (playing === it.n ? ' on' : '')} data-testid="bubble">
              <div className="who">{it.who}{edited && <em className="edtag" data-testid={tp + '-edited'}> · 已修改</em>}</div>
              <div className="bbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : real ? playClip(it) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">点一下看泰文</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <Rom roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              {actions(it0)}
            </div>)
        })() : <div key={i} className="dsec"><span>{(it0 as { sec: string }).sec}</span></div>)}
      </div>)}
      <div className="dlgbar"><button className={'nx' + (all ? ' stop' : '')} onClick={playAll} aria-label={all ? '停止' : tx.all} data-testid={tp + '-playall'}>{all ? '⏹' : '▶'}</button></div>
    </div>)
}
