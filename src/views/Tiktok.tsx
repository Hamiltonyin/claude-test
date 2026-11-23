import { useEffect, useState } from 'react'
import { Speaker, TapRoman, VowelInfoCard } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'
import { get, put } from '../lib/db'
import { lookupSyllable } from '../lib/vowelLookup'

/** TikTok 收藏：刷到好的泰语视频，把链接存下来，之后回来学。
 *  - 内置的（content/tiktok.json）：我从视频里抄好了句子、标好读音，有电子音
 *  - 自己加的：只存在这台手机（IndexedDB meta 'tiktok:mine'），可以写备注、写下想学的句子 */
interface Line { th: string; roman: string; zh: string; clip?: string }
interface Item { id: string; url: string; title: string; note?: string; lyric?: string; lines?: Line[]; mine?: boolean; added?: number; text?: string }

let cache: Promise<Item[]> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/tiktok.json`).then(r => r.ok ? r.json() : []).catch(() => { cache = null; return [] }))
export const TT_KEY = 'tiktok:mine'
export const FB_KEY = 'facebook:mine'
// 同一个收藏页给两个网站用：TikTok 有内置收藏；Facebook 只有自己加的
const SITES = {
  tiktok: { key: TT_KEY, name: 'TikTok', icon: '📌', re: /https?:\/\/\S*tiktok\.com\/\S+/, ok: /tiktok\.com\//, builtIn: true },
  facebook: { key: FB_KEY, name: 'Facebook', icon: '📘', re: /https?:\/\/\S*(facebook\.com|fb\.watch|fb\.com|fb\.me)\/\S+/, ok: /(facebook\.com|fb\.watch|fb\.com|fb\.me)\//, builtIn: false },
} as const
export type Site = keyof typeof SITES

export default function Tiktok({ onClose, onLyrics, site = 'tiktok' }: { onClose: () => void; onLyrics?: () => void; site?: Site }) {
  const S = SITES[site]
  const [built, setBuilt] = useState<Item[]>([])
  const [mine, setMine] = useState<Item[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ url: '', title: '', text: '' })
  const [playing, setPlaying] = useState<string | null>(null)
  const [vq, setVq] = useState<ReturnType<typeof lookupSyllable>>(null)
  useEffect(() => { let on = true; if (S.builtIn) load().then(d => on && setBuilt(d)); get<Item[]>('meta', S.key).then(d => on && d && setMine(d)).catch(() => {}); return () => { on = false; stopAudio() } }, [S])

  const saveMine = (list: Item[]) => { setMine(list); void put('meta', list, S.key) }
  const add = () => {
    const m = draft.url.match(S.re)
    if (!m) return
    saveMine([{ id: 'my-' + Date.now(), url: m[0], title: draft.title.trim() || '未命名', text: draft.text.trim(), mine: true, added: Date.now() }, ...mine])
    setDraft({ url: '', title: '', text: '' }); setAdding(false)
  }
  const remove = (id: string) => { if (confirm('删除这条收藏？')) saveMine(mine.filter(x => x.id !== id)) }
  const say = async (key: string, l: { th: string; clip?: string }) => {
    stopAudio(); setPlaying(key)
    try { if (!l.clip) throw new Error('no file'); await playFile(l.clip, false) } catch { try { await playSystem(l.th, false) } catch { /* 没有语音 */ } }
    setPlaying(p => (p === key ? null : p))
  }
  // 自己写的句子：一行一句，泰文就能点着听（系统语音）
  const myLines = (t?: string) => (t ?? '').split('\n').map(x => x.trim()).filter(Boolean)

  const all = [...mine, ...built]
  return (
    <div className="study dlgpage" role="dialog" aria-label={`${S.name} 收藏`}>
      <div className="sthead">
        <button className="close" onClick={onClose}>‹</button>
        <div className="prog"><b className="dtitle">{S.icon} {S.name} 收藏</b></div>
        <button className={'gdot wide' + (adding ? ' on' : '')} onClick={() => setAdding(!adding)} data-testid="tt-add">＋ 收藏</button>
      </div>
      <div className="ttlist">
        {adding && <div className="ttform" data-testid="tt-form">
          <input value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder={`粘贴 ${S.name} 链接（分享 → 复制链接）`} inputMode="url" autoCapitalize="off" data-testid="tt-url" />
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="起个名字（歌名 / 内容）" data-testid="tt-title" />
          <textarea value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} placeholder="想学的句子（可选，一行一句，泰文点了能听）" rows={3} data-testid="tt-text" />
          <button className="btn block" disabled={!S.ok.test(draft.url)} onClick={add} data-testid="tt-save">保存</button>
        </div>}
        {vq && <VowelInfoCard q={vq} onClose={() => setVq(null)} />}
        {all.map(it => (
          <div key={it.id} className="ttcard" data-testid="tt-item">
            <div className="tthead">
              <b>{it.title}</b>
              <a className="ttopen" href={it.url} target="_blank" rel="noreferrer" data-testid="tt-open">打开 {S.name} ↗</a>
            </div>
            {it.note && <p className="ttnote">{it.note}</p>}
            {it.lines?.map((l, i) => (
              <div key={i} className={'ttline' + (playing === it.id + i ? ' on' : '')} onClick={() => void say(it.id + i, l)} data-testid="tt-line">
                <div className="th" lang="th">{l.th}</div>
                <TapRoman roman={l.roman} onTap={s => setVq(lookupSyllable(s))} />
                <div className="dz">{l.zh}</div>
                <span className="ttspk" aria-hidden><Speaker /></span>
              </div>))}
            {myLines(it.text).map((t, i) => (
              <div key={'m' + i} className={'ttline' + (playing === it.id + 'm' + i ? ' on' : '')} onClick={() => void say(it.id + 'm' + i, { th: t })}>
                <div className={/[฀-๿]/.test(t) ? 'th' : 'dz'} lang="th">{t}</div>
                {/[฀-๿]/.test(t) && <span className="ttspk" aria-hidden><Speaker /></span>}
              </div>))}
            <div className="ttfoot">
              {it.lyric && onLyrics && <button className="link" onClick={onLyrics} data-testid="tt-lyric">去歌词背诵 ›</button>}
              {it.mine && <span className="sub">我加的 · {new Date(it.added ?? 0).toLocaleDateString()}</span>}
              {it.mine && <button className="link danger" onClick={() => remove(it.id)} data-testid="tt-del">删除</button>}
            </div>
          </div>))}
        {!all.length && <p className="sub" style={{ textAlign: 'center', margin: 30 }}>还没有收藏。点右上角「＋ 收藏」粘贴链接。</p>}
      </div>
    </div>)
}
