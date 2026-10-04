// 音频：优先播放已保存的真实 MP3（audio/<词ID>.mp3，Service Worker 缓存）；
// 失败时可选用系统语音朗读（明确标注，并非存档音频）。任何失败都抛出带说明的错误，绝不静默。
export type AudioSource = 'file' | 'system'
export class AudioError extends Error {
  constructor(public code: 'missing' | 'offline' | 'blocked' | 'nosys' | 'other', message: string) { super(message) }
}

const base = import.meta.env.BASE_URL
export const audioUrl = (id: string) => `${base}audio/${id}.mp3`

let current: HTMLAudioElement | null = null
export function stopAudio() {
  if (current) { current.pause(); current = null }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function hasFile(id: string): Promise<boolean> {
  try { const r = await fetch(audioUrl(id), { method: 'HEAD', cache: 'force-cache' }); return r.ok && (r.headers.get('content-type') || '').includes('audio') }
  catch { return false }
}

/** 播放存档音频。slow=true 使用 0.8 倍速（保持音高）。 */
export async function playFile(id: string, slow: boolean): Promise<void> {
  stopAudio()
  let res: Response
  try { res = await fetch(audioUrl(id)) }
  catch { throw new AudioError('offline', navigator.onLine ? '无法加载音频文件（网络错误）。' : '当前离线，且这个词的音频还没有缓存。') }
  const ct = res.headers.get('content-type') || ''
  if (!res.ok || !ct.includes('audio')) throw new AudioError('missing', '这个词的存档音频还没有生成（服务器上没有对应 MP3）。')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = new Audio(url)
  a.preservesPitch = true
  a.playbackRate = slow ? 0.8 : 1
  current = a
  try {
    await a.play()
  } catch (e: any) {
    URL.revokeObjectURL(url)
    throw new AudioError(e?.name === 'NotAllowedError' ? 'blocked' : 'other',
      e?.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请直接点按喇叭按钮。' : '音频播放失败：' + (e?.message || e))
  }
  await new Promise<void>(res2 => { a.onended = () => { URL.revokeObjectURL(url); res2() }; a.onerror = () => { URL.revokeObjectURL(url); res2() } })
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
