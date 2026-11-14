import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { ToneLine, TONE_COLOR, Speaker } from '../ui'
import { TONE_ZH } from '../lib/tone'
import { playFile, playSystem, stopAudio } from '../lib/audio'
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
        <div className="vowintro"><b>怎么用</b><p>每一组是「同一个音节、不同声调」。先逐个听，注意音高走向（曲线）；再点「整组连读」连着听一遍，最后用「听音辨调」自测。第一组来自你发的 The 5 Tones 截图。</p></div>
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
            <div className="tonebtns">
              <button onClick={() => void playAll(s)} data-testid="tone-all"><Speaker /> {playing ? '停止' : '整组连读'}</button>
              <button className="quiz" onClick={() => startQuiz(s)} data-testid="tone-quiz">🎯 听音辨调</button>
            </div>
          </section>))}
        <p className="sub" style={{ margin: '14px 4px' }}>声音是合成语音，不是真人。声调的绝对高低因人而异，要听的是同一个人的音高「走向」和相互对比。</p>
      </div>
    </div>)
}
