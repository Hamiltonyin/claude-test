import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from './types'
import { AudioError, playFile, playSystem, stopAudio, systemVoiceAvailable } from './lib/audio'
import { useApp } from './store'
import { today } from './lib/dates'
import { loadClusters, type Cluster } from './lib/clusters'
import { TONE_SYMBOL, TONE_ZH, toneCodes, toneDescription } from './lib/tone'

export const Speaker = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>
)
export const Turtle = () => <span aria-hidden style={{ fontSize: 17 }}>🐢</span>

export function LevelPill({ level }: { level: Level }) {
  return <span className="pill" style={{ background: LEVEL_COLORS[level] }}>{LEVEL_NAMES[level]}</span>
}

interface Fail { msg: string; code: AudioError['code']; word: Word; slow: boolean }
/** 发音控制：存档音频（正常/0.8倍速）+ 明确的错误提示、重试和系统语音备用 */
export function useSpeaker() {
  const { countPlay } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [fail, setFail] = useState<Fail | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const seq = useRef(0)
  const play = useCallback(async (word: Word, slow: boolean) => {
    const my = ++seq.current
    countPlay(word.id)
    setFail(null); setInfo(null); setBusy(word.id + (slow ? 's' : 'n'))
    try { await playFile(word.id, slow) }
    catch (e: any) {
      if (my === seq.current) setFail({ msg: e?.message || '播放失败', code: e?.code ?? 'other', word, slow })
    } finally { if (my === seq.current) setBusy(null) }
  }, [countPlay])
  const playSys = useCallback(async (word: Word, slow: boolean) => {
    setFail(null); setBusy(word.id + 'sys')
    try { setInfo('正在使用系统语音朗读（不是存档音频，发音由设备决定）'); await playSystem(word.thai, slow); setInfo(null) }
    catch (e: any) { setInfo(null); setFail({ msg: e?.message || '系统语音失败', code: 'nosys', word, slow }) }
    finally { setBusy(null) }
  }, [])
  const stop = useCallback(() => { seq.current++; stopAudio(); setBusy(null) }, [])
  useEffect(() => stop, [stop])
  const toast: ReactNode = (fail || info) && (
    <div className="toast" role="alert"><div className={'note ' + (fail ? 'err' : 'ok')}>
      {fail ? <>🔊 {fail.msg}</> : info}
      {fail && <div className="acts">
        <button onClick={() => play(fail.word, fail.slow)}>重试</button>
        {systemVoiceAvailable() || fail.code === 'missing' || fail.code === 'offline'
          ? <button onClick={() => playSys(fail.word, fail.slow)}>用系统语音（非存档）</button> : null}
        <button onClick={() => setFail(null)}>关闭</button>
      </div>}
    </div></div>
  )
  return { play, busy, toast, stop }
}

export function SpeakButtons({ word, sp }: { word: Word; sp: ReturnType<typeof useSpeaker> }) {
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <div className="spk" onClick={stopProp} onTouchEnd={stopProp}>
      <button aria-label="播放发音" className={sp.busy === word.id + 'n' ? 'busy' : ''} onClick={() => sp.play(word, false)}><Speaker /></button>
      <button aria-label="慢速播放（0.8倍）" className={'slow ' + (sp.busy === word.id + 's' ? 'busy' : '')} onClick={() => sp.play(word, true)}><Turtle />0.8×</button>
    </div>
  )
}

export const TONE_COLOR: Record<string, string> = { M: '#1e6fd9', L: '#2e9e4f', F: '#e0392d', H: '#e8830c', R: '#8e44ad' }
const TONE_PATH: Record<string, string> = { M: '3,10 37,10', L: '3,11 37,16', F: '3,3 37,17', H: '3,11 37,4', R: '3,9 14,16 37,3' }

/** 声调曲线：一条线表示这个音节的音高走向（中平/低/降/高/升） */
export function ToneLine({ code }: { code: string }) {
  const c = TONE_COLOR[code]
  const [x, y] = TONE_PATH[code].split(' ')[0].split(',')
  return (
    <svg className="toneline" viewBox="0 0 40 20" aria-hidden>
      <line x1="3" y1="3" x2="37" y2="3" stroke="#e5e7eb" strokeDasharray="2 2" /><line x1="3" y1="17" x2="37" y2="17" stroke="#e5e7eb" strokeDasharray="2 2" />
      <polyline points={TONE_PATH[code]} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x} cy={y} r="3" fill={c} />
    </svg>
  )
}

/** 单词的声调提示：每个音节 = 拼音 + 声调曲线 + 声调名/符号 */
export function ToneChips({ roman }: { roman: string }) {
  return (
    <div className="tonebox" data-testid="tones">
      {toneDescription(roman).map((d, i) => (
        <span className="tone" key={i} style={{ borderColor: TONE_COLOR[d.code] }}>
          <b className="rom" style={{ color: TONE_COLOR[d.code] }}>{d.syl}</b>
          <ToneLine code={d.code} />
          <span className="tname" style={{ color: TONE_COLOR[d.code] }}>{d.name}{d.code !== 'M' && <> {TONE_SYMBOL[d.code]}</>}</span>
        </span>
      ))}
    </div>
  )
}

/** 拼音按声调上色（句子、词组里用），音节顺序和声调符号一目了然 */
export function ColorRoman({ roman, className = 'rom' }: { roman: string; className?: string }) {
  const parts = roman.split(/([-\s]+)/)
  return <div className={className}>{parts.map((p, i) => /^[-\s]+$/.test(p) || !p ? p : <span key={i} style={{ color: TONE_COLOR[toneCodes(p)] ?? undefined, fontWeight: 600 }}>{p}</span>)}</div>
}

export function ToneLegend() {
  return (
    <div className="tlegend">
      {(['M', 'L', 'F', 'H', 'R'] as const).map(c => <span key={c} style={{ color: TONE_COLOR[c] }}>● {TONE_ZH[c]}</span>)}
    </div>
  )
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <div className="sheet" onClick={onClose}><div onClick={e => e.stopPropagation()}>{children}</div></div>
}

export const Chev = () => <span className="chev">›</span>

/** 例句/词组的小喇叭：优先播放存档 MP3（<词ID>_ex / _p<N>），没有时用系统泰语语音 */
export function ClipButton({ id, suffix, text, label, onPlay }: { id: string; suffix: string; text: string; label: string; onPlay?: () => void }) {
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation()
  const [busy, setBusy] = useState(false)
  const go = (slow: boolean) => {
    onPlay?.()
    setBusy(true)
    playFile(id, slow, suffix).catch(() => playSystem(text, slow)).catch(() => {}).finally(() => setBusy(false))
  }
  return (
    <span className="clip" onClick={stopProp} onTouchEnd={stopProp}>
      <button aria-label={label} className={busy ? 'busy' : ''} onClick={() => go(false)}><Speaker /></button>
      <button aria-label={label + '（慢速）'} className="slow" onClick={() => go(true)}>🐢</button>
    </span>
  )
}

export interface Phrase { th: string; roman: string; zh: string }
type PhraseMap = Record<string, { id: string; items: Phrase[] }>
let phraseCache: Promise<PhraseMap> | null = null
export const loadPhrases = () => (phraseCache ??= fetch(`${import.meta.env.BASE_URL}content/phrases.json`).then(r => r.ok ? r.json() : {}).catch(() => { phraseCache = null; return {} }))
export function usePhrases(word: Word): Phrase[] {
  const [map, setMap] = useState<PhraseMap | null>(null)
  useEffect(() => {
    let on = true; loadPhrases().then(m => on && setMap(m)); return () => { on = false }
  }, [])
  return map?.[word.thai]?.items ?? []
}

/** 例句（可发音）+ 常用词组（可发音）。signal 每变一次，例句卡片就「翻」一下（自动朗读时触发），并有自己的计数。 */
/** 例句出场动画（每次随机一种）：翻转 / 虚化变实 / 左右擦除 / 翻书页 / 缩放旋转 / 上下擦除 */
const FX = ['rot', 'blur', 'wipel', 'wiper', 'page', 'spin', 'wiped'] as const
export function ExampleBlock({ word, signal = 0, show }: { word: Word; signal?: number; show?: boolean }) {   // show 未传 = 静态显示；传了 = 先隐藏、等 true 时用随机动画出场
  const phrases = usePhrases(word)
  const { exPlays, countExPlay } = useApp()
  const [manual, setManual] = useState(0)
  const key = signal + manual
  const fx = useMemo(() => FX[Math.floor(Math.random() * FX.length)], [key, show])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div key={'ex' + key + String(show)} className={'ex' + (show ? ' exfx fx-' + fx : '')} style={show === false ? { visibility: 'hidden' } : undefined} data-testid="example" data-fx={show ? fx : ''}>
        <ToneLegend />
        <div className="exrow"><div className="th" lang="th">{word.exTh}</div><ClipButton id={word.id} suffix="_ex" text={word.exTh} label="播放例句" onPlay={() => { countExPlay(word.id); setManual(m => m + 1) }} /></div>
        <ColorRoman roman={word.exRoman} />
        <div className="z">{word.exZh}</div>
        <ExCount n={exPlays[word.id] ?? 0} />
      </div>
      {phrases.length > 0 && (
        <div className={'ex phr' + (show ? ' phrin' : '')} style={show === false ? { visibility: 'hidden' } : undefined} data-testid="phrases">
          <div className="phrh">常用词组</div>
          {phrases.map((x, i) => (
            <div key={i} className="phrow">
              <div><div className="th" lang="th">{x.th}</div><ColorRoman roman={x.roman} /><div className="sub" style={{ fontSize: 13 }}>{x.zh}</div></div>
              <ClipButton id={word.id} suffix={'_p' + i} text={x.th} label="播放词组" />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** 例句自己的计数（和单词的「已翻/已听」分开），数字增加时同样弹跳 + 飘 +1 */
export function ExCount({ n }: { n: number }) {
  return <div className="excnt" data-testid="ex-count"><Num n={n} label="例句已听" /></div>
}

/** 播放一句例句（优先存档 MP3，没有就用系统泰语语音）。 */
export async function playExample(word: Word) {
  try { await playFile(word.id, false, '_ex') } catch { try { await playSystem(word.exTh, false) } catch { /* 没有存档音频也没有系统语音：自动朗读时静默跳过 */ } }
}

/** 淡淡的计数：已翻 N 次 · 已听 M 次。数字增加时弹一下，并飘起一个 +1。 */
function Num({ n, label }: { n: number; label: string }) {
  const prev = useRef(n)
  const [k, setK] = useState(0)
  useEffect(() => { if (n > prev.current) setK(x => x + 1); prev.current = n }, [n])
  return (
    <span className="cnum">{label} <b key={'b' + k} className={k ? 'cpop' : ''}>{n}</b> 次{k > 0 && <i key={'p' + k} className="cplus">+1</i>}</span>
  )
}
export function CountBadge({ id, className = 'flipcnt' }: { id: string; className?: string }) {
  const { flips, plays, exPlays, wordDaily } = useApp()
  const day = wordDaily[id]?.[today()]
  const todayN = (day?.p ?? 0) + (day?.e ?? 0)                 // 今日听读 = 今天单词发音 + 例句发音
  const total = (plays[id] ?? 0) + (exPlays[id] ?? 0)          // 累计听读
  return <div className={className} data-testid="counts"><Num n={todayN} label="今日听读" /> · <Num n={total} label="累计听读" /> · <Num n={flips[id] ?? 0} label="翻卡" /></div>
}

/** 小庆祝特效：彩纸/星星从中间向四周飘散。k 每变一次触发一次；big = 更多更大。 */
const BURST_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff6482']
export function Burst({ k, big = false }: { k: number; big?: boolean }) {
  if (!k) return null
  const n = big ? 26 : 14
  return (
    <div className="burst" key={k} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = (big ? 120 : 80) + Math.random() * (big ? 120 : 70)
        return <span key={i} style={{ ['--dx' as any]: `${Math.cos(a) * d}px`, ['--dy' as any]: `${Math.sin(a) * d - 40}px`, ['--rot' as any]: `${Math.random() * 540 - 270}deg`, background: BURST_COLORS[i % BURST_COLORS.length], animationDelay: `${Math.random() * 80}ms` }} />
      })}
      <em>{big ? '🎉' : '✨'}</em>
    </div>
  )
}

/** 卡片背面：和这个词关联的词（近义/反义/同类），一眼看出它和谁是一组 */
export function RelatedWords({ word }: { word: Word }) {
  const { words } = useApp()
  const [cl, setCl] = useState<Cluster[]>([])
  useEffect(() => { let on = true; loadClusters().then(c => on && setCl(c)); return () => { on = false } }, [])
  const mine = cl.filter(c => c.words.includes(word.thai)).slice(0, 2)
  if (!mine.length) return null
  const byThai = new Map(words.map(w => [w.thai, w]))
  return (
    <div className="related" data-testid="related">
      {mine.map(c => (
        <div key={c.id} className="rel">
          <div className="relh">{c.emoji} {c.name}</div>
          <div className="relw">{c.words.filter(t => t !== word.thai && byThai.has(t)).slice(0, 9).map(t => <span key={t} className="relchip"><b className="th" lang="th">{t}</b><i>{byThai.get(t)!.zh.split(/[；;（(]/)[0]}</i></span>)}</div>
        </div>
      ))}
    </div>
  )
}
