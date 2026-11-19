import { useEffect, useRef, useState } from 'react'
import { ColorRoman, Speaker, VideoBar } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put, del } from '../lib/db'

interface Line { n: number; who: string; me: boolean; th: string; roman: string; zh: string; clip: string; t?: [number, number] }
type Item = Line | { sec: string }
interface Edit { th?: string; roman?: string; zh?: string }
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

  // —— 真人视频：每段对话可以导入一个自己的视频（只存本机），再给每一句设起止秒数，点 🎬 就播放那一段 ——
  const [vurl, setVurl] = useState<string | null>(null)
  const [vclips, setVclips] = useState<Record<string, [number, number]>>({})
  const [calOpen, setCalOpen] = useState<number | null>(null)
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
    get('meta', 'dlgvideo:' + curId).then((b: unknown) => { if (ok && b instanceof Blob) { u = URL.createObjectURL(b); setVurl(u) } }).catch(() => {})
    const defs: Record<string, [number, number]> = {}   // 内容里预先记录好的起止秒（按原视频），自己调过的优先
    for (const it of cur?.items ?? []) if (isLine(it) && it.t) defs[it.n] = it.t
    setVclips(defs)
    get<Record<string, Edit>>('meta', 'dlgedit:' + curId).then(o => { if (ok && o) setEdits(o) }).catch(() => {})
    get<Record<string, [number, number]>>('meta', 'dlgclips:' + curId).then(o => { if (ok && o) setVclips({ ...defs, ...o }) }).catch(() => {})
    return () => { ok = false; if (u) URL.revokeObjectURL(u) }
  }, [curId])
  const importVideo = async (f: File | undefined) => {
    if (!f || !curId) return
    try { await put('meta', f, 'dlgvideo:' + curId) } catch { /* 存不下也先能播这一次 */ }
    if (vurl) URL.revokeObjectURL(vurl); setVurl(URL.createObjectURL(f))
  }
  const removeVideo = async () => { if (!curId) return; await del('meta', 'dlgvideo:' + curId).catch(() => {}); if (vurl) URL.revokeObjectURL(vurl); setVurl(null) }
  const saveClip = (n: number, c: [number, number] | null) => {
    if (!curId) return
    const m = { ...vclips }; if (c) m[n] = [Math.max(0, +c[0].toFixed(2)), Math.max(0, +c[1].toFixed(2))]; else delete m[n]
    setVclips(m); void put('meta', m, 'dlgclips:' + curId)
  }
  const eff = (l: Line): Line => { const e = edits[l.n]; return e ? { ...l, th: e.th ?? l.th, roman: e.roman ?? l.roman, zh: e.zh ?? l.zh } : l }
  const saveEdit = (l: Line, e: Edit | null) => {
    if (!curId) return
    const m = { ...edits }
    const clean: Edit = {}
    if (e) { if (e.th?.trim() && e.th.trim() !== l.th) clean.th = e.th.trim(); if (e.roman?.trim() && e.roman.trim() !== l.roman) clean.roman = e.roman.trim(); if (e.zh?.trim() && e.zh.trim() !== l.zh) clean.zh = e.zh.trim() }
    if (Object.keys(clean).length) m[l.n] = clean; else delete m[l.n]
    setEdits(m); void put('meta', m, 'dlgedit:' + curId); setEditOpen(null)
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
  const playAll = () => {
    if (!cur) return
    if (all) { tok.current++; stopAudio(); vid.current?.pause(); setAll(false); setPlaying(null); return }
    const my = ++tok.current; setAll(true)
    const lines = cur.items.filter(isLine)
    void (async () => {
      for (const l of lines) {
        if (tok.current !== my) return
        refs.current.get(l.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (vurl && vclips[l.n]) { await new Promise<void>(r => { playClip(l, r); setTimeout(r, ((vclips[l.n][1] - vclips[l.n][0]) + 3) * 1000) }) } else await say(l)
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
        <p className="sub" style={{ margin: '16px 4px' }}>用法：点一句话听发音（导入了真人视频的句子优先播真人，电子音是旁边的小按钮）；✏️ 可以改泰文/拼音/中文，⏱ 校准视频时间；可以遮住泰文只看中文，自己先说一遍再点开对答案。</p>
      </div>
    </div>)

  const lines = cur.items.filter(isLine)
  return (
    <div className="study dlgpage" role="dialog" aria-label={cur.title}>
      <div className="sthead"><button className="close" onClick={() => { tok.current++; stopAudio(); vid.current?.pause(); setAll(false); setPlaying(null); setCur(null) }}>‹ 对话</button><div className="prog"><b>{cur.emoji} {cur.title}</b></div><div className="cnt">{lines.length} 句</div></div>
      {vurl && <div className="vowvid">
        <video ref={vid} src={vurl} playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => { setPlaying(null); const d = clipDone.current; clipDone.current = null; d?.() }} data-testid="dlg-video" />
        <VideoBar vid={vid} />
        <button className="link" onClick={() => void removeVideo()}>移除视频</button> <button className="link" onClick={() => void exportClips()}>复制时间轴和修改</button>
        {vmsg && <p className="sub" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{vmsg}</p>}
      </div>}
      <div className="dlgtools">
        {!vurl && <label className="dlgvidimport">📥 导入真人视频（可选，只存在这台手机）<input type="file" accept="video/*,audio/*" onChange={e => void importVideo(e.target.files?.[0])} data-testid="dlg-vfile" /></label>}
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} data-testid="dlg-roman" /> 拼音</label>
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} data-testid="dlg-zh" /> 中文</label>
        <label><input type="checkbox" checked={hideTh} onChange={e => { setHideTh(e.target.checked); setPeek(new Set()) }} data-testid="dlg-hide" /> 遮住泰文（自测）</label>
      </div>
      <div className="chat" data-testid="chat">
        {cur.items.map((it0, i) => isLine(it0) ? (() => {
          const it = eff(it0), edited = !!edits[it0.n], real = !!(vurl && vclips[it.n])
          const hidden = hideTh && !peek.has(it.n)
          return (
            <div key={i} ref={el => { if (el) refs.current.set(it.n, el); else refs.current.delete(it.n) }} className={'bub ' + (it.me ? 'me' : 'other') + (playing === it.n ? ' on' : '')} data-testid="bubble">
              <div className="who">{it.who}{edited && <em className="edtag" data-testid="dlg-edited"> · 已修改</em>}</div>
              <div className="bbody" onClick={() => hidden ? setPeek(new Set(peek).add(it.n)) : real ? playClip(it) : playOne(it)}>
                {hidden ? <div className="th masked" lang="th">点一下看泰文</div> : <div className="th" lang="th">{it.th}</div>}
                {showRoman && !hidden && <ColorRoman roman={it.roman} />}
                {showZh && <div className="dz">{it.zh}</div>}
              </div>
              <div className="bplay">
                {vurl && <button className={'real' + (vclips[it.n] ? ' has' : '')} disabled={!vclips[it.n]} onClick={() => playClip(it)} aria-label="播放真人" data-testid="dlg-vclip">🎬 {vclips[it.n] ? `真人 ${vclips[it.n][0].toFixed(1)}–${vclips[it.n][1].toFixed(1)}s` : '未设时间'}</button>}
                <button className={real ? 'robot' : ''} onClick={() => playOne(it)} aria-label={real ? '电子语音' : '播放这一句'} data-testid="bplay">{real ? <>🤖<small>电子音</small></> : <Speaker />}</button>
                {!real && <button className="slow" onClick={() => playOne(it, true)} aria-label="慢速播放">🐢</button>}
                <button className="more" onClick={() => { setEditOpen(editOpen === it.n ? null : it.n); setCalOpen(null); setDraft({ th: it.th, roman: it.roman, zh: it.zh }) }} aria-label="修改文字" data-testid="dlg-editbtn">✏️</button>
                {vurl && <button className="more" onClick={() => { setCalOpen(calOpen === it.n ? null : it.n); setEditOpen(null) }} aria-label="校准时间" data-testid="dlg-calbtn">⏱</button>}
              </div>
              {editOpen === it.n && (
                <div className="dlgedit" data-testid="dlg-edit">
                  <label>泰文<input value={draft.th ?? ''} onChange={e => setDraft({ ...draft, th: e.target.value })} lang="th" data-testid="dlg-edit-th" /></label>
                  <label>拼音<input value={draft.roman ?? ''} onChange={e => setDraft({ ...draft, roman: e.target.value })} data-testid="dlg-edit-roman" /></label>
                  <label>中文<input value={draft.zh ?? ''} onChange={e => setDraft({ ...draft, zh: e.target.value })} data-testid="dlg-edit-zh" /></label>
                  <div className="dlgeditbtn"><button className="save" onClick={() => saveEdit(it0, draft)} data-testid="dlg-edit-save">保存</button>{edited && <button onClick={() => saveEdit(it0, null)} data-testid="dlg-edit-reset">恢复原文</button>}<button onClick={() => setEditOpen(null)}>取消</button></div>
                  <p className="sub" style={{ fontSize: 11.5, margin: '4px 0 0' }}>听到的读音和标的不一样？直接改泰文/拼音。改了泰文后，「电子音」会按新泰文读；真人视频不受影响。只存在这台手机，可在「我的」里备份。</p>
                </div>)}
              {vurl && calOpen === it.n && (() => { const c = vclips[it.n]; const cur0 = () => vid.current?.currentTime ?? 0; const [a, b] = c ?? [0, 0]; return (
                <div className="vowcal" data-testid="dlg-cal">
                  <div className="vowcalh">时间轴 <b data-testid="dlg-range">{c ? `${a.toFixed(2)}s – ${b.toFixed(2)}s` : '未设置'}</b>{c && <button className="link" onClick={() => saveClip(it.n, null)}>清除</button>}</div>
                  <div className="vowcalr"><span>起点</span><button onClick={() => saveClip(it.n, [a - 0.1, b])}>-0.1</button><button onClick={() => saveClip(it.n, [a + 0.1, b])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [cur0(), c ? Math.max(b, cur0() + 0.8) : cur0() + 1.5])} data-testid="dlg-setstart">设为视频当前位置</button></div>
                  <div className="vowcalr"><span>终点</span><button onClick={() => saveClip(it.n, [a, b - 0.1])}>-0.1</button><button onClick={() => saveClip(it.n, [a, b + 0.1])}>+0.1</button><button className="set" onClick={() => saveClip(it.n, [a, cur0()])} data-testid="dlg-setend">设为视频当前位置</button></div>
                  <p className="sub" style={{ fontSize: 11.5, margin: '4px 0 0' }}>拖上面的视频到这句刚开始说的位置 →「起点」设为当前位置；说完的位置 →「终点」。设好后点「🎬 视频」试听。</p>
                </div>) })()}
            </div>)
        })() : <div key={i} className="dsec"><span>{(it0 as { sec: string }).sec}</span></div>)}
      </div>
      <div className="dlgbar"><button className={'nx' + (all ? ' stop' : '')} onClick={playAll} data-testid="dlg-playall">{all ? '⏹ 停止' : '▶ 连续播放整段对话'}</button></div>
    </div>)
}
