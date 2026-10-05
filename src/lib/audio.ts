// 音频：优先播放已保存的真实 MP3（audio/<词ID>.mp3，Service Worker 缓存）；
// 失败时可选用系统语音朗读（明确标注，并非存档音频）。任何失败都抛出带说明的错误，绝不静默。
export type AudioSource = 'file' | 'system'
export class AudioError extends Error {
  constructor(public code: 'missing' | 'offline' | 'blocked' | 'nosys' | 'other', message: string) { super(message) }
}

const base = import.meta.env.BASE_URL
export const audioUrl = (id: string) => `${base}audio/${id}.mp3`

// iPhone Safari 只允许在「用户点按的同一瞬间」开始播放，且需复用同一个 <audio> 元素：
// 因此 play() 必须在点击回调里同步调用（之前先 fetch 再播放会丢失用户手势，导致自动朗读被拒绝）。
let el: HTMLAudioElement | null = null
const getEl = () => (el ??= new Audio())

export function stopAudio() {
  if (el) { el.onended = null; el.onerror = null; el.pause() }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function hasFile(id: string): Promise<boolean> {
  try { const r = await fetch(audioUrl(id), { method: 'HEAD', cache: 'force-cache' }); return r.ok && (r.headers.get('content-type') || '').includes('audio') }
  catch { return false }
}

/** 播放存档音频。slow=true 为 0.8 倍速（保持音高）。必须在用户手势回调中同步调用。 */
export function playFile(id: string, slow: boolean): Promise<void> {
  stopAudio()
  const a = getEl()
  a.preservesPitch = true
  return new Promise<void>((resolve, reject) => {
    const done = () => { a.onended = null; a.onerror = null }
    a.onended = () => { done(); resolve() }
    a.onerror = () => {
      done()
      reject(new AudioError(navigator.onLine ? 'missing' : 'offline',
        navigator.onLine ? '这个词的存档音频还没有生成（服务器上没有对应 MP3）。' : '当前离线，且这个词的音频还没有缓存。'))
    }
    const rate = slow ? 0.8 : 1
    a.defaultPlaybackRate = rate
    a.src = audioUrl(id)
    a.playbackRate = rate
    const p = a.play()   // 同步调用，保持用户手势
    p?.catch((e: any) => {
      done()
      if (e?.name === 'AbortError') return resolve()   // 被新的播放/停止打断
      reject(new AudioError(e?.name === 'NotAllowedError' ? 'blocked' : 'other',
        e?.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请直接点按喇叭按钮。' : '音频播放失败：' + (e?.message || e)))
    })
  })
}

export function systemVoiceAvailable(): boolean {
  if (!('speechSynthesis' in window)) return false
  return window.speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith('th'))
}
/** 系统语音（备用）。注意：不是存档音频，声调准确性取决于设备的泰语语音。 */
export function playSystem(text: string, slow: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) return reject(new AudioError('nosys', '此设备不支持系统语音朗读。'))
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find(x => x.lang.toLowerCase().replace('_', '-').startsWith('th'))
    if (!v) return reject(new AudioError('nosys', '设备上没有泰语系统语音。可在 iPhone「设置 > 辅助功能 > 朗读内容 > 声音 > 泰语」下载。'))
    stopAudio()
    const u = new SpeechSynthesisUtterance(text)
    u.voice = v; u.lang = v.lang; u.rate = slow ? 0.55 : 0.85
    u.onend = () => resolve()
    u.onerror = (e) => reject(new AudioError('other', '系统语音朗读失败：' + (e as any).error))
    window.speechSynthesis.speak(u)
  })
}

/** 一键把全部音频下载进 Service Worker 缓存（离线可用） */
export async function downloadAll(ids: string[], onProgress: (done: number, fail: number) => void) {
  let done = 0, fail = 0
  const queue = [...ids]
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try { const r = await fetch(audioUrl(id)); if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) fail++ ; else await r.arrayBuffer() } catch { fail++ }
      done++; onProgress(done, fail)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { done, fail }
}
