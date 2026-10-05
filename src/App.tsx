import { useMemo, useState } from 'react'
import { AppProvider, useApp } from './store'
import Home from './views/Home'
import Library from './views/Library'
import Stats from './views/Stats'
import Me from './views/Me'
import Study, { type StudyMode } from './views/Study'
import { weakWords } from './lib/srs'

type Tab = 'home' | 'library' | 'stats' | 'me'
interface StudyState { title: string; ids: string[]; mode: StudyMode }

const icons: Record<Tab, string> = {
  home: 'M12 3 3 10v10h6v-6h6v6h6V10z',
  library: 'M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z',
  stats: 'M5 20V10h3v10zm5.5 0V4h3v16zM16 20v-7h3v7z',
  me: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z',
}
const labels: Record<Tab, string> = { home: '首页', library: '词库', stats: '统计', me: '我的' }

function Shell() {
  const { ready, error, session, progress, words, lessons } = useApp()
  const [tab, setTab] = useState<Tab>('home')
  const [study, setStudy] = useState<StudyState | null>(null)
  const startToday = () => session && setStudy({ title: '今天学习', ids: session.newIds, mode: 'today' })
  const startReview = () => session && setStudy({ title: '今日复习', ids: session.reviewIds, mode: 'review' })
  const startWeak = () => setStudy({ title: '重点复习', ids: weakWords(progress).map(p => p.wordId), mode: 'weak' })
  const startTheme = (t: string) => {
    const ids = words.filter(w => w.theme === t).sort((a, b) => ((progress.get(a.id)?.level ?? 0) || 0.5) - ((progress.get(b.id)?.level ?? 0) || 0.5)).map(w => w.id)
    setStudy({ title: t, ids, mode: 'theme' })
  }
  useMemo(() => lessons, [lessons])
  if (error) return <div className="center"><div><h2>数据库打开失败</h2><p className="sub">{error}</p><p className="sub">请确认未处于无痕模式，且存储空间足够；然后刷新重试。</p><button className="btn" onClick={() => location.reload()}>刷新</button></div></div>
  if (!ready) return <div className="center"><div className="sub">加载中…</div></div>
  return (
    <div className="app">
      <div className="scroll">
        {tab === 'home' && <Home onStudy={m => m === 'today' ? startToday() : m === 'review' ? startReview() : startWeak()} onLibrary={() => setTab('library')} onTheme={startTheme} />}
        {tab === 'library' && <Library onStudy={(title, ids, mode) => setStudy({ title, ids, mode })} />}
        {tab === 'stats' && <Stats />}
        {tab === 'me' && <Me />}
      </div>
      <nav className="tabbar">
        {(Object.keys(icons) as Tab[]).map(t => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} data-testid={'tab-' + t}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d={icons[t]} /></svg>{labels[t]}
          </button>))}
      </nav>
      {study && <Study key={study.title + study.ids.length} {...study} onClose={() => setStudy(null)} />}
    </div>
  )
}
export default function App() { return <AppProvider><Shell /></AppProvider> }
