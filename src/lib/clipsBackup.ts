import { db } from './db'

/** 视频时间轴备份：把元音页、声调页、情景对话里你校准过的「起止秒数」导出成一个小 JSON 文件（视频本身不在里面，因为太大）。 */
export interface ClipsBackup { app: 'thai30-clips'; version: 1; exportedAt: number; vowelClips?: unknown; toneClips?: unknown; dlgclips?: Record<string, unknown>; dlgedit?: Record<string, unknown>; lyrclips?: Record<string, unknown>; lyredit?: Record<string, unknown>; tiktok?: unknown[]; facebook?: unknown[]; bmuse?: Record<string, { open: number; play: number; last: number }> }

export async function collectClips(): Promise<ClipsBackup> {
  const d = await db()
  const keys = (await d.getAllKeys('meta')) as IDBValidKey[]
  const out: ClipsBackup = { app: 'thai30-clips', version: 1, exportedAt: Date.now() }
  for (const k of keys) {
    if (typeof k !== 'string') continue
    if (k === 'vowelClips') out.vowelClips = await d.get('meta', k)
    else if (k === 'toneClips') out.toneClips = await d.get('meta', k)
    else if (k === 'tiktok:mine') out.tiktok = await d.get('meta', k)
    else if (k === 'facebook:mine') out.facebook = await d.get('meta', k)
    else if (k === 'bmuse') out.bmuse = await d.get('meta', k)
    else if (k.startsWith('lyredit:')) (out.lyredit ??= {})[k.slice(8)] = await d.get('meta', k)
    else if (k.startsWith('lyrclips:')) (out.lyrclips ??= {})[k.slice(9)] = await d.get('meta', k)
    else if (k.startsWith('dlgedit:')) (out.dlgedit ??= {})[k.slice(8)] = await d.get('meta', k)
    else if (k.startsWith('dlgclips:')) (out.dlgclips ??= {})[k.slice(9)] = await d.get('meta', k)
  }
  return out
}
export const countClips = (b: ClipsBackup) => (b.vowelClips ? Object.keys(b.vowelClips as object).length : 0) + (b.toneClips ? Object.keys(b.toneClips as object).length : 0) + Object.values(b.dlgclips ?? {}).reduce((a: number, v) => a + Object.keys(v as object).length, 0) + Object.values(b.dlgedit ?? {}).reduce((a: number, v) => a + Object.keys(v as object).length, 0) + Object.values(b.lyrclips ?? {}).reduce((a: number, v) => a + Object.keys(v as object).length, 0) + Object.values(b.lyredit ?? {}).reduce((a: number, v) => a + Object.keys(v as object).length, 0) + (b.tiktok?.length ?? 0) + (b.facebook?.length ?? 0)

export async function restoreClips(b: ClipsBackup): Promise<number> {
  if (!b || b.app !== 'thai30-clips') throw new Error('不是时间轴备份文件')
  const d = await db(); let n = 0
  const merge = async (key: string, incoming: unknown) => {
    if (!incoming || typeof incoming !== 'object') return
    const cur = ((await d.get('meta', key)) ?? {}) as Record<string, unknown>
    const next = { ...cur, ...(incoming as Record<string, unknown>) }
    await d.put('meta', next, key); n += Object.keys(incoming as object).length
  }
  await merge('vowelClips', b.vowelClips); await merge('toneClips', b.toneClips)
  for (const [list, key] of [[b.tiktok, 'tiktok:mine'], [b.facebook, 'facebook:mine']] as const) {   // TikTok / Facebook 收藏：按 id 合并，不重复
    if (!Array.isArray(list)) continue
    const cur = ((await d.get('meta', key)) ?? []) as { id: string }[]
    const ids = new Set(cur.map(x => x.id)); const add = (list as { id: string }[]).filter(x => !ids.has(x.id))
    await d.put('meta', [...cur, ...add], key); n += add.length
  }
  if (b.bmuse && typeof b.bmuse === 'object') {   // 收藏的使用次数：每项取较大的那个，不会越恢复越多
    const cur = ((await d.get('meta', 'bmuse')) ?? {}) as NonNullable<ClipsBackup['bmuse']>
    for (const [id, u] of Object.entries(b.bmuse)) { const c = cur[id]; cur[id] = c ? { open: Math.max(c.open, u.open), play: Math.max(c.play, u.play), last: Math.max(c.last, u.last) } : u }
    await d.put('meta', cur, 'bmuse')
  }
  for (const [id, v] of Object.entries(b.dlgclips ?? {})) await merge('dlgclips:' + id, v)
  for (const [id, v] of Object.entries(b.dlgedit ?? {})) await merge('dlgedit:' + id, v)
  for (const [id, v] of Object.entries(b.lyrclips ?? {})) await merge('lyrclips:' + id, v)
  for (const [id, v] of Object.entries(b.lyredit ?? {})) await merge('lyredit:' + id, v)
  return n
}

/** 用系统分享面板导出（iPhone 上可以选「存储到文件」「云端硬盘 Google Drive」「AirDrop」等）；不支持时退回为下载文件。 */
export async function shareFile(name: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([text], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return 'shared' } catch (e: any) { if (e?.name === 'AbortError') return 'shared' }
  }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
