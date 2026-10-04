import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LEVEL_COLORS, LEVEL_NAMES, type Level, type Word } from './types'
import { AudioError, playFile, playSystem, stopAudio, systemVoiceAvailable } from './lib/audio'
import { TONE_SYMBOL, toneDescription } from './lib/tone'

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

export function ToneChips({ roman }: { roman: string }) {
  return (
    <div className="tonebox">
      {toneDescription(roman).map((d, i) => (
        <span className="tone" key={i}><b className="rom">{d.syl}</b> {d.name}{d.code !== 'M' && <span className="sub"> {TONE_SYMBOL[d.code]}</span>}</span>
      ))}
    </div>
  )
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <div className="sheet" onClick={onClose}><div onClick={e => e.stopPropagation()}>{children}</div></div>
}

export const Chev = () => <span className="chev">›</span>
