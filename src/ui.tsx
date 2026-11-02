import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from './types'
import { AudioError, playFile, playSystem, stopAudio, systemVoiceAvailable } from './lib/audio'
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
  const [busy, setBusy] = useState<string | null>(null)
  const [fail, setFail] = useState<Fail | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const seq = useRef(0)
  const play = useCallback(async (word: Word, slow: boolean) => {
    const my = ++seq.current
    setFail(null); setInfo(null); setBusy(word.id + (slow ? 's' : 'n'))
    try { await playFile(word.id, slow) }
    catch (e: any) {
      if (my === seq.current) setFail({ msg: e?.message || '播放失败', code: e?.code ?? 'other', word, slow })
    } finally { if (my === seq.current) setBusy(null) }
  }, [])
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
export function ClipButton({ id, suffix, text, label }: { id: string; suffix: string; text: string; label: string }) {
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation()
  const [busy, setBusy] = useState(false)
  const go = (slow: boolean) => {
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
let phraseCache: Promise<Record<string, { id: string; items: Phrase[] }>> | null = null
export function usePhrases(word: Word): Phrase[] {
  const [map, setMap] = useState<Record<string, { id: string; items: Phrase[] }> | null>(null)
  useEffect(() => {
    phraseCache ??= fetch(`${import.meta.env.BASE_URL}content/phrases.json`).then(r => r.ok ? r.json() : {}).catch(() => { phraseCache = null; return {} })
    let on = true; phraseCache.then(m => on && setMap(m)); return () => { on = false }
  }, [])
  return map?.[word.thai]?.items ?? []
}

/** 例句（可发音）+ 常用词组（可发音） */
export function ExampleBlock({ word }: { word: Word }) {
  const phrases = usePhrases(word)
  return (
    <>
      <div className="ex" data-testid="example">
        <ToneLegend />
        <div className="exrow"><div className="th" lang="th">{word.exTh}</div><ClipButton id={word.id} suffix="_ex" text={word.exTh} label="播放例句" /></div>
        <ColorRoman roman={word.exRoman} />
        <div className="z">{word.exZh}</div>
      </div>
      {phrases.length > 0 && (
        <div className="ex phr" data-testid="phrases">
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
