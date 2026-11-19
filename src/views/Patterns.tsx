import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { ColorRoman, Speaker, VideoBar } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put, del, listKeys } from '../lib/db'

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
  // —— 真人读音：自己上传视频/音频，只存在这台手机里；有真人读音的句子，点一下就播放真人的 ——
  const [recs, setRecs] = useState<Record<string, string>>({})   // clip → 本地播放地址（blob URL）
  const [playingRec, setPlayingRec] = useState<{ clip: string; th: string } | null>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const urls = useRef<Record<string, string>>({})
  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        const keys = (await listKeys('meta')).filter(k => typeof k === 'string' && k.startsWith('patrec:')) as string[]
        const next: Record<string, string> = {}
        for (const k of keys) { const b = await get('meta', k); if (b instanceof Blob) next[k.slice(7)] = URL.createObjectURL(b) }
        if (ok) { urls.current = next; setRecs(next) }
      } catch { /* 无痕模式等：不影响其他功能 */ }
    })()
    return () => { ok = false; Object.values(urls.current).forEach(u => URL.revokeObjectURL(u)) }
  }, [])
  const upload = async (e: Ex, f: File | undefined) => {
    if (!f) return
    try { await put('meta', f, 'patrec:' + e.clip) } catch { /* 存不下也先能播这一次 */ }
    if (urls.current[e.clip]) URL.revokeObjectURL(urls.current[e.clip])
    urls.current = { ...urls.current, [e.clip]: URL.createObjectURL(f) }; setRecs(urls.current)
  }
  const removeRec = async (e: Ex) => {
    await del('meta', 'patrec:' + e.clip).catch(() => {})
    if (urls.current[e.clip]) URL.revokeObjectURL(urls.current[e.clip])
    const n = { ...urls.current }; delete n[e.clip]; urls.current = n; setRecs(n)
    if (playingRec?.clip === e.clip) { vid.current?.pause(); setPlayingRec(null) }
  }
  /** 播放真人读音：必须在点击回调里同步调用 play()（iPhone 要求），所以地址在页面打开时就准备好了 */
  const playRec = (e: Ex) => {
    const u = urls.current[e.clip], el = vid.current; if (!u || !el) return
    stopAudio(); setOn(e.clip); setPlayingRec({ clip: e.clip, th: e.th })
    el.src = u; el.currentTime = 0
    void el.play().catch(() => {})
  }
  useEffect(() => { let ok = true; load().then(d => ok && setData(d)); return () => { ok = false; stopAudio() } }, [])
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])
  const sayEx = async (e: Ex) => {
    if (recs[e.clip]) return playRec(e)
    vid.current?.pause(); setOn(e.clip); stopAudio()
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
      <div className="recplayer" style={{ display: playingRec ? 'block' : 'none' }} data-testid="rec-player">
        <video ref={vid} playsInline onEnded={() => setOn(null)} data-testid="rec-video" />
        <VideoBar vid={vid} />
        {playingRec && <div className="recname">🎬 真人读音：<span className="th" lang="th">{playingRec.th}</span> <button className="link" onClick={() => { vid.current?.pause(); setPlayingRec(null); setOn(null) }}>关闭</button></div>}
      </div>
      <div className="patlist">
        <div className="vowintro">
          <b>怎么用</b>
          <p>泰国人句子里有很多客气小词（ครับ、นะ、หน่อย、ด้วย…），<b>意思上基本可以不管</b>，抓住骨架就懂。但它们几乎每句都出现，要会听、会用，不然说出来很生硬。每个句式后面有 2 个例句，点一下读音。<b>想像背单词一样翻卡学习：</b>到「学习」页 → 往下找「句式卡片」，每张卡<b>正面是中文，翻过来才是泰语</b>，会自动记录熟悉程度、安排复习。</p>
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
                  <div key={e.clip} className="patexwrap">
                    <button className={'patex' + (on === e.clip ? ' on' : '')} onClick={() => void sayEx(e)} data-testid="pat-ex">
                      <span className="th" lang="th">{e.th}</span>
                      <ColorRoman roman={e.roman} className="ptrom" />
                      {!hideZh && <i>{e.zh}</i>}
                      <span className="wspk" aria-hidden>{recs[e.clip] ? '🎬' : <Speaker />}</span>
                    </button>
                    <div className="recbar">
                      {recs[e.clip] ? (<>
                        <span className="recok" data-testid="rec-has">✓ 已有真人读音（点上面这句就播放）</span>
                        <button onClick={() => { vid.current?.pause(); setOn(e.clip); stopAudio(); void playFile(e.clip, false).catch(() => playSystem(e.th, false)).catch(() => {}) }}>🤖 机器读音</button>
                        <label className="recup">替换<input type="file" accept="video/*,audio/*" onChange={ev => void upload(e, ev.target.files?.[0])} /></label>
                        <button onClick={() => void removeRec(e)}>删除</button>
                      </>) : (
                        <label className="recup main">📎 上传真人读音（视频或音频）<input type="file" accept="video/*,audio/*" onChange={ev => void upload(e, ev.target.files?.[0])} data-testid="rec-file" /></label>)}
                    </div>
                  </div>))}
              </div>))}
          </section>))}
        <p className="sub" style={{ margin: '14px 4px' }}>句式和例句是我按常见说法整理的，没有母语者审过。默认声音是合成语音；你上传的真人读音只存在这台手机里，不会上传到网上，换手机或清除网站数据后需要重新上传。</p>
      </div>
    </div>)
}
