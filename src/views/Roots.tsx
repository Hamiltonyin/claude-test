import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { ColorRoman, Speaker } from '../ui'
import { playFile, playSystem, stopAudio } from '../lib/audio'

interface Root { th: string; roman: string; zh: string; id: string; rule: string; members: string[] }
let cache: Promise<Root[]> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}content/roots.json`).then(r => r.ok ? r.json() : []).catch(() => { cache = null; return [] }))

/** 构词规律：像「说文解字」里的偏旁——同一个部件会出现在很多词里，认出规律就能推理出新词的意思。 */
export default function Roots({ onClose }: { onClose: () => void }) {
  const { words, countPlay } = useApp()
  const [list, setList] = useState<Root[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { let on = true; load().then(d => on && setList(d)); return () => { on = false; stopAudio() } }, [])
  const byThai = useMemo(() => new Map(words.map(w => [w.thai, w])), [words])
  const say = async (id: string, th: string) => {
    if (byThai.has(th)) countPlay(byThai.get(th)!.id)
    setBusy(th)
    try { await playFile(id, false) } catch { try { await playSystem(th, false) } catch { /* 没有语音 */ } }
    setBusy(b => (b === th ? null : b))
  }
  return (
    <div className="study rootpage" role="dialog" aria-label="构词规律">
      <div className="sthead"><button className="close" onClick={onClose}>‹ 返回</button><div className="prog"><b>🧩 构词规律</b></div><div className="cnt">{list?.length ?? 0} 个</div></div>
      <div className="rootlist">
        <div className="vowintro"><b>怎么用</b><p>像中文的偏旁部首：同一个「部件」会出现在很多词里。先看规律那句话，再看它造出的词，遇到没学过的新词，也能先猜出大概意思。点任何一个都能听读音。</p></div>
        {list?.map(r => (
          <section key={r.th} className="rootcard" data-testid="root">
            <button className="roothead" onClick={() => void say(r.id, r.th)}>
              <span className="th big" lang="th">{r.th}</span>
              <span className="rootmid"><ColorRoman roman={r.roman} /><span className="z">{r.zh}</span></span>
              <span className="rootn">{r.members.length} 个词</span>
              <span className={'wspk' + (busy === r.th ? ' on' : '')}><Speaker /></span>
            </button>
            <p className="rootrule">{r.rule}</p>
            <div className="rootmem">
              {r.members.map(m => { const w = byThai.get(m); return w ? (
                <button key={m} className={'relchip' + (busy === m ? ' on' : '')} onClick={() => void say(w.id, m)} data-testid="root-member">
                  <b className="th" lang="th">{m}</b><ColorRoman roman={w.roman} className="relrom" /><i>{w.zh.split(/[；;（(]/)[0]}</i>
                </button>) : null })}
            </div>
          </section>))}
      </div>
    </div>)
}
