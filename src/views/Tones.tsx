import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { ToneLine, TONE_COLOR, Speaker } from '../ui'
import { TONE_ZH } from '../lib/tone'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put, del } from '../lib/db'
import type { Word } from '../types'

interface Item { th: string; tone: string }
interface TSet { id: string; title: string; note: string; items: Item[] }
interface Data { source: string; sets: TSet[] }

let cache: Promise<Data | null> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/tones.json`).then(r => r.ok ? r.json() : null).catch(() => { cache = null; return null }))
const shuffle = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 声调校对：同一个音节的五个声调并排听；「听音辨调」随机播一个，你来选是哪个声调。 */
export default function Tones({ onClose }: { onClose: () => void }) {
  const { words, countPlay } = useApp()
  const [data, setData] = useState<Data | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<{ set: TSet; qs: Word[]; i: number; picked: string | null; right: number; wrong: Record<string, number> } | null>(null)
  const tok = useRef(0)
  // —— 本机视频：导入后，每个词可以标记它在视频里的起止秒数，点一下就播放那一段 ——
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clips, setClips] = useState<Record<string, [number, number]>>({})
  const [calOpen, setCalOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const vid = useRef<HTMLVideoElement>(null)
  const stopAt = useRef<number | null>(null)
  const clipDone = useRef<(() => void) | null>(null)
  useEffect(() => { get<Record<string, [number, number]>>('meta', 'toneClips').then(o => o && setClips(o)).catch(() => {}) }, [])
  useEffect(() => { let u: string | null = null; get('meta', 'toneVideo').then((b: unknown) => { if (b instanceof Blob) { u = URL.createObjectURL(b); setUrl(u) } }).catch(() => {}); return () => { if (u) URL.revokeObjectURL(u) } }, [])
  const importVideo = async (f: File | undefined) => {
    if (!f) return; setBusy(true)
    try { await put('meta', f, 'toneVideo'); if (url) URL.revokeObjectURL(url); setUrl(URL.createObjectURL(f)) } finally { setBusy(false) }
  }
  const removeVideo = async () => { await del('meta', 'toneVideo'); if (url) URL.revokeObjectURL(url); setUrl(null) }
  const saveClip = (th: string, c: [number, number] | null) => {
    const n = { ...clips }; if (c) n[th] = [Math.max(0, +c[0].toFixed(2)), Math.max(0, +c[1].toFixed(2))]; else delete n[th]
    setClips(n); void put('meta', n, 'toneClips')
  }
  const finishClip = () => { const f = clipDone.current; clipDone.current = null; f?.() }
  const playClip = (th: string): Promise<void> => {
    const el = vid.current, c = clips[th]; if (!el || !c) return Promise.resolve()
    finishClip(); stopAudio(); setPlaying('clip-' + th)
    stopAt.current = c[1]; el.currentTime = c[0]
    return new Promise<void>(res => { clipDone.current = res; el.play().catch(() => { setPlaying(null); finishClip() }) })
  }
  const onTime = () => { const el = vid.current; if (el && stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; setPlaying(null); finishClip() } }
  const exportClips = async () => { const t = JSON.stringify(clips); try { await navigator.clipboard.writeText(t); setMsg('已复制全部视频时间轴，发给我就能固化进网站') } catch { setMsg(t) } }
  useEffect(() => { let on = true; load().then(d => on && setData(d)); return () => { on = false } }, [])
  useEffect(() => () => { tok.current++; stopAudio() }, [])
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])

  const say = async (w: Word, slow = false) => {
    countPlay(w.id); setPlaying(w.thai)
    try { await playFile(w.id, slow) } catch { try { await playSystem(w.thai, slow) } catch { /* 没有语音 */ } }
    setPlaying(p => (p === w.thai ? null : p))
  }
  const playAll = async (s: TSet) => {
    if (playing) { tok.current++; stopAudio(); setPlaying(null); return }
    const my = ++tok.current
    for (const it of s.items) {
      const w = byThai.get(it.th); if (!w || my !== tok.current) break
      await say(w); await wait(450)
    }
  }

  const startQuiz = (s: TSet) => {
    tok.current++; stopAudio(); setPlaying(null)
    const ws = s.items.map(i => byThai.get(i.th)).filter((w): w is Word => !!w)
    const qs = shuffle([...ws, ...ws]).slice(0, Math.min(10, ws.length * 2))
    setQuiz({ set: s, qs, i: 0, picked: null, right: 0, wrong: {} })
    void say(qs[0])
  }
  const toneOf = (s: TSet, w: Word) => s.items.find(i => i.th === w.thai)!.tone
  const answer = (code: string) => {
    if (!quiz || quiz.picked) return
    const w = quiz.qs[quiz.i], ok = toneOf(quiz.set, w) === code
    const key = ok ? '' : `${TONE_ZH[toneOf(quiz.set, w)]}→${TONE_ZH[code]}`
    setQuiz({ ...quiz, picked: code, right: quiz.right + (ok ? 1 : 0), wrong: key ? { ...quiz.wrong, [key]: (quiz.wrong[key] ?? 0) + 1 } : quiz.wrong })
  }
  const next = () => {
    if (!quiz) return
    const i = quiz.i + 1
    setQuiz({ ...quiz, i, picked: null })
    if (i < quiz.qs.length) void say(quiz.qs[i])
  }

  if (quiz) {
    const done = quiz.i >= quiz.qs.length
    const w = quiz.qs[quiz.i]
    return (
      <div className="study tonepage" role="dialog" aria-label="听音辨调">
        <div className="sthead"><button className="close" onClick={() => { stopAudio(); setQuiz(null) }}>‹ 返回</button><div className="prog"><b>🎯 听音辨调</b></div><div className="cnt">{Math.min(quiz.i + 1, quiz.qs.length)}/{quiz.qs.length}</div></div>
        <div className="tonequiz">
          {done ? (
            <div className="tqres" data-testid="tq-result">
              <h2>{quiz.right}/{quiz.qs.length} 题答对</h2>
              {Object.keys(quiz.wrong).length > 0 ? <p>容易混的：{Object.entries(quiz.wrong).map(([k, n]) => `${k}（${n} 次）`).join('、')}。<br />「正确→你选的」。把这两个声调在上面并排多听几遍。</p> : <p>全对！换一组再来。</p>}
              <button className="nx" onClick={() => startQuiz(quiz.set)}>再来一轮</button>
            </div>
          ) : (<>
            <p className="sub">听这个音节，选出它的声调（本组：{quiz.set.title.split('（')[0]}）</p>
            <button className="tqplay" onClick={() => void say(w)} data-testid="tq-play"><Speaker /> 再听一次</button>
            <div className="tqopts">
              {quiz.set.items.map(it => {
                const picked = quiz.picked, right = toneOf(quiz.set, w) === it.tone
                return (
                  <button key={it.tone} className={'tqopt' + (picked ? (right ? ' ok' : picked === it.tone ? ' no' : '') : '')} style={{ borderColor: TONE_COLOR[it.tone] }} onClick={() => answer(it.tone)} data-testid="tq-opt" data-tone={it.tone}>
                    <ToneLine code={it.tone} /><b style={{ color: TONE_COLOR[it.tone] }}>{TONE_ZH[it.tone]}</b>
                    {picked && <span className="th" lang="th">{it.th}</span>}
                  </button>)
              })}
            </div>
            {quiz.picked && <>
              <p className="tqfb" data-testid="tq-fb">{toneOf(quiz.set, w) === quiz.picked ? '✓ 对了' : '✗ 不对'} —— 刚才是 <b className="th" lang="th">{w.thai}</b> {w.roman}（{w.zh}）</p>
              <button className="nx" onClick={next} data-testid="tq-next">{quiz.i + 1 >= quiz.qs.length ? '看结果' : '下一题'}</button>
            </>}
          </>)}
        </div>
      </div>)
  }

  return (
    <div className="study tonepage" role="dialog" aria-label="声调校对">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>🎼 声调校对</b></div><div className="cnt">{data?.sets.length ?? 0} 组</div></div>
      <div className="tonelist">
        {url && <div className="vowvid">
          <video ref={vid} src={url} controls playsInline preload="metadata" onTimeUpdate={onTime} onEnded={() => { setPlaying(null); finishClip() }} data-testid="tone-video" />
          <button className="link" onClick={() => void removeVideo()}>移除本机视频</button> <button className="link" onClick={() => void exportClips()}>复制全部时间轴</button>
          {msg && <p className="sub" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{msg}</p>}
        </div>}
        <div className="vowintro"><b>怎么用</b><p>每一组是「同一个音节、不同声调」。先逐个听，注意音高走向（曲线）；再点「整组连读」连着听一遍，最后用「听音辨调」自测。第一组来自你发的 The 5 Tones 截图。</p>
          {!url && <label className="vowimport"><input type="file" accept="video/*" onChange={e => void importVideo(e.target.files?.[0])} data-testid="tone-file" /><span>{busy ? '导入中…' : '📥 导入教学视频（只存在你这台手机里，不会上传）'}</span></label>}
          {url && <p className="sub" style={{ fontSize: 12 }}>视频已导入：在每组下面「⚙ 校准视频时间」里，拖视频到某个声调开始读的位置 →「起点设为当前位置」，读完 →「终点」，之后点 🎬 就播放那一段。</p>}
        </div>
        {data?.sets.map(s => (
          <section key={s.id} className="tonesec" data-testid="tone-set">
            <h3>{s.title}</h3>
            <p className="sub" style={{ margin: '2px 0 8px' }}>{s.note}</p>
            <div className="tonerow">
              {s.items.map(it => { const w = byThai.get(it.th); return w ? (
                <button key={it.th} className={'tonecard' + (playing === it.th ? ' on' : '')} style={{ borderColor: TONE_COLOR[it.tone] }} onClick={() => void say(w)} data-testid="tone-card">
                  <span className="th big" lang="th" style={{ color: TONE_COLOR[it.tone] }}>{w.thai}</span>
                  <span className="rom" style={{ color: TONE_COLOR[it.tone], fontWeight: 700 }}>{w.roman}</span>
                  <ToneLine code={it.tone} />
                  <span className="tname" style={{ color: TONE_COLOR[it.tone] }}>{TONE_ZH[it.tone]}</span>
                  <span className="tz">{w.zh.split(/[；（]/)[0]}</span>
                </button>) : null })}
            </div>
            {url && <div className="tonevid">
              <div className="tonebtns" style={{ marginTop: 6 }}>
                {s.items.map(it => <button key={it.th} className={'vchip' + (clips[it.th] ? '' : ' dim')} onClick={() => clips[it.th] ? void playClip(it.th) : setCalOpen(s.id)} data-testid="tone-vclip"><span className="th" lang="th">{it.th}</span> 🎬{playing === 'clip-' + it.th ? '…' : ''}</button>)}
              </div>
              <button className="calbtn" onClick={() => setCalOpen(calOpen === s.id ? null : s.id)} data-testid="tone-calbtn">⚙ 校准视频时间 {calOpen === s.id ? '⌃' : '⌄'}</button>
              {calOpen === s.id && s.items.map(it => { const c = clips[it.th]; const cur = () => vid.current?.currentTime ?? 0; const [a, b] = c ?? [0, 0]; return (
                <div key={it.th} className="vowcal" data-testid="tone-cal">
                  <div className="vowcalh"><span className="th" lang="th" style={{ fontSize: 18 }}>{it.th}</span> <b data-testid="tone-range">{c ? `${a.toFixed(2)}s – ${b.toFixed(2)}s` : '未设置'}</b>{c && <button className="link" onClick={() => saveClip(it.th, null)}>清除</button>}</div>
                  <div className="vowcalr"><span>起点</span><button onClick={() => saveClip(it.th, [a - 0.1, b])}>-0.1</button><button onClick={() => saveClip(it.th, [a + 0.1, b])}>+0.1</button><button className="set" onClick={() => saveClip(it.th, [cur(), c ? Math.max(b, cur() + 0.8) : cur() + 1.2])} data-testid="tone-setstart">设为视频当前位置</button></div>
                  <div className="vowcalr"><span>终点</span><button onClick={() => saveClip(it.th, [a, b - 0.1])}>-0.1</button><button onClick={() => saveClip(it.th, [a, b + 0.1])}>+0.1</button><button className="set" onClick={() => saveClip(it.th, [a, cur()])} data-testid="tone-setend">设为视频当前位置</button></div>
                </div>) })}
            </div>}
            <div className="tonebtns">
              <button onClick={() => void playAll(s)} data-testid="tone-all"><Speaker /> {playing ? '停止' : '整组连读'}</button>
              <button className="quiz" onClick={() => startQuiz(s)} data-testid="tone-quiz">🎯 听音辨调</button>
            </div>
          </section>))}
        <p className="sub" style={{ margin: '14px 4px' }}>声音是合成语音，不是真人。声调的绝对高低因人而异，要听的是同一个人的音高「走向」和相互对比。</p>
      </div>
    </div>)
}
