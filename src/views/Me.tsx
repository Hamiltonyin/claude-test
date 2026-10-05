import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { CSV_HEADER, toCSV } from '../lib/csv'
import { checkRows, isBackup, parseEntries, toWord, type CheckedRow, type Row } from '../lib/importer'
import { downloadAll, hasFile } from '../lib/audio'
import { validateWord } from '../lib/tone'
import { wordIdFor } from '../lib/ids'
import type { Word } from '../types'
import { today } from '../lib/dates'

function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })

function ImportPanel() {
  const { words, lessons, addWords, rebuildSession } = useApp()
  const nextDay = Math.max(0, ...lessons.map(l => l.day)) + 1
  const [text, setText] = useState('')
  const [day, setDay] = useState(nextDay)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const checked: CheckedRow[] = rows ? checkRows(rows, words) : []
  const parse = (src: string) => {
    try { const r = parseEntries(src); setRows(r); setMsg(r.length ? null : { t: 'err', s: '没有解析到任何行' }) }
    catch (e: any) { setRows(null); setMsg({ t: 'err', s: '解析失败：' + e.message }) }
  }
  const edit = (k: number, f: keyof Row, v: string) => setRows(rows!.map(r => r.key === k ? { ...r, [f]: v } : r))
  const good = checked.filter(r => !r.errors.length && r.dup !== 'batch')
  const commit = async () => {
    const newWords: Word[] = [], adds = new Map<number, string[]>()
    for (const r of good) {
      const id = r.existingId ?? wordIdFor(r.thai)
      if (!r.existingId && !newWords.some(w => w.id === id)) newWords.push(toWord(r))
      const d = r.day ?? day; adds.set(d, [...(adds.get(d) ?? []), id])
    }
    await addWords(newWords, [...adds].map(([d, wordIds]) => ({ day: d, wordIds })))
    await rebuildSession()
    setMsg({ t: 'ok', s: `已导入：新增词条 ${newWords.length}，写入课程 ${[...adds.keys()].map(d => '第' + d + '天').join('、')}（共 ${good.length} 条课程记录）。已有词条与学习记录未改动。` })
    setRows(null); setText(''); setDay(Math.max(nextDay, ...adds.keys()) + 1)
  }
  return (
    <div className="panel">
      <h3>添加 / 导入课程（CSV · JSON）</h3>
      <p className="sub">每天 30 条。列：{CSV_HEADER.join(', ')}（可无表头，day 为空则用下方课程天数）。导入时自动校验泰文与声调、检查重复；重复词复用原词条与进度。</p>
      <textarea className="big" placeholder={'day,thai,roman,zh,theme,exTh,exRoman,exZh\n3,ห้อง,hɔ̂ɔng,房间,居家,ห้องนี้ใหญ่,hɔ̂ɔng níi yài,这个房间很大'} value={text} onChange={e => setText(e.target.value)} data-testid="import-text" />
      <label className="field"><span>默认课程天数</span><input type="number" min={1} value={day} onChange={e => setDay(Number(e.target.value) || 1)} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sec" style={{ flex: 1 }} onClick={() => parse(text)} data-testid="import-parse">解析并校验</button>
        <label className="btn sec" style={{ flex: 1, textAlign: 'center' }}>选择文件<input type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const t = await readFile(f); setText(t); parse(t) } e.target.value = '' }} /></label>
      </div>
      {msg && <div className={'note ' + msg.t} role="status">{msg.s}</div>}
      {rows && <>
        <div className="note">共 {checked.length} 行：可导入 {good.length}，需修正 {checked.filter(r => r.errors.length).length}，词库已有 {checked.filter(r => r.dup === 'library').length}，批内重复 {checked.filter(r => r.dup === 'batch').length}。可直接在表格中修改后自动重新校验。</div>
        <div style={{ overflowX: 'auto' }}><table className="pv"><tbody>
          {checked.map(r => <tr key={r.key} className={r.errors.length ? 'bad' : r.dup !== 'none' ? 'dup' : ''}>
            <td style={{ minWidth: 60 }}><input className="th" value={r.thai} onChange={e => edit(r.key, 'thai', e.target.value)} /></td>
            <td><input value={r.roman} onChange={e => edit(r.key, 'roman', e.target.value)} /></td>
            <td><input value={r.zh} onChange={e => edit(r.key, 'zh', e.target.value)} /></td>
            <td style={{ fontSize: 11, minWidth: 70 }}>{r.errors.length ? '⚠ ' + r.errors.join('；') : r.dup === 'library' ? '已有词（仅归课）' : r.dup === 'batch' ? '批内重复（跳过）' : '✓'}</td>
          </tr>)}
        </tbody></table></div>
        <button className="btn block" disabled={!good.length} onClick={commit} data-testid="import-commit">导入 {good.length} 条</button>
      </>}
    </div>
  )
}

export default function Me() {
  const { exportBackup, restoreBackup, words, lessons, settings, updateSettings, mergeLibrary, rebuildSession } = useApp()
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [dl, setDl] = useState<string | null>(null)
  const [audioN, setAudioN] = useState<number | null>(null)
  const [persist, setPersist] = useState<string>('检测中…')
  const pending = useRef<any>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    (async () => {
      const ok = await Promise.all(words.slice(0, 200).map(w => hasFile(w.id)))
      setAudioN(ok.filter(Boolean).length)
    })()
    navigator.storage?.persisted?.().then(p => setPersist(p ? '已启用（浏览器不会自动清理）' : '未授予（添加到主屏幕后更可靠；请定期备份）')).catch(() => setPersist('无法检测'))
  }, [words.length])

  const backup = () => {
    const b = exportBackup()
    saveFile(`thai30-backup-${today()}.json`, JSON.stringify(b), 'application/json')
    updateSettings({ lastBackupAt: Date.now() })
    setMsg({ t: 'ok', s: `已导出备份（${b.words.length} 词，${b.progress.length} 条进度，${b.logs.length} 条复习日志）。请保存到「文件」或 iCloud。` })
  }
  const onRestore = async (f: File) => {
    try {
      const j = JSON.parse(await readFile(f))
      if (!isBackup(j)) throw new Error('不是 Thai 30 备份文件')
      pending.current = j; setConfirm(true); setMsg(null)
    } catch (e: any) { setMsg({ t: 'err', s: '读取备份失败：' + e.message }) }
  }
  const doRestore = async (mode: 'replace' | 'merge') => {
    try { await restoreBackup(pending.current, mode); await rebuildSession(); setMsg({ t: 'ok', s: mode === 'replace' ? '已用备份覆盖当前数据。' : '已合并备份（进度取较新者）。' }) }
    catch (e: any) { setMsg({ t: 'err', s: '恢复失败：' + e.message }) }
    setConfirm(false)
  }
  const exportLib = (fmt: 'csv' | 'json') => {
    const dayOf = new Map<string, number>(); lessons.forEach(l => l.wordIds.forEach(id => { if (!dayOf.has(id)) dayOf.set(id, l.day) }))
    if (fmt === 'json') saveFile('thai30-library.json', JSON.stringify({ words, lessons }, null, 2), 'application/json')
    else saveFile('thai30-library.csv', toCSV([CSV_HEADER, ...words.map(w => [dayOf.get(w.id) ?? '', w.thai, w.roman, w.zh, w.theme, w.exTh, w.exRoman, w.exZh])]), 'text/csv')
  }
  const exportLessons = () => {
    const rows: (string | number)[][] = [CSV_HEADER]
    const m = new Map(words.map(w => [w.id, w]))
    for (const l of lessons) for (const id of l.wordIds) { const w = m.get(id); if (w) rows.push([l.day, w.thai, w.roman, w.zh, w.theme, w.exTh, w.exRoman, w.exZh]) }
    saveFile('thai30-lesson-records.csv', toCSV(rows), 'text/csv')
  }
  const downloadAudio = async () => {
    setDl('下载中…')
    const r = await downloadAll(words.map(w => w.id), (d, f) => setDl(`下载中 ${d}/${words.length}（失败 ${f}）`))
    setDl(r.fail ? `完成，但有 ${r.fail} 个词没有音频文件（服务器尚未生成）。` : `全部 ${r.done} 个音频已缓存，可离线播放。`)
  }
  const refreshLib = async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}content/library.json`, { cache: 'no-cache' })
      if (!r.ok) throw new Error('服务器无词库更新（' + r.status + '）')
      const j = await r.json(); const n = await mergeLibrary(j.words, j.lessons ?? [])
      await rebuildSession()
      setMsg({ t: 'ok', s: n ? `已合并服务器上的新增内容（${n} 项）。` : '已是最新，没有新增内容。' })
    } catch (e: any) { setMsg({ t: 'err', s: '检查更新失败：' + (navigator.onLine ? e.message : '当前离线') }) }
  }

  return (
    <>
      <h1>我的</h1>
      {msg && <div className={'note ' + msg.t} role="status">{msg.s}</div>}
      <div className="panel"><h3>数据保存</h3>
        <p className="sub">学习记录保存在本机 IndexedDB（关闭 Safari、刷新、升级版本都不会清空）。持久存储：{persist}</p>
        <p className="sub">上次备份：{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('zh-CN') : '从未备份'}</p>
        <button className="btn block" onClick={backup} data-testid="backup">导出 JSON 备份</button>
        <label className="btn sec block" style={{ textAlign: 'center' }}>从备份恢复<input type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onRestore(f); e.target.value = '' }} /></label>
        {confirm && <div className="note">选择恢复方式：<br />「合并」保留现有数据，进度取较新者（推荐）；「覆盖」用备份替换全部数据。
          <div className="toast acts" style={{ position: 'static', display: 'flex', gap: 8, marginTop: 8 }}><button className="btn" onClick={() => doRestore('merge')}>合并</button><button className="btn danger" onClick={() => doRestore('replace')}>覆盖</button><button className="btn sec" onClick={() => setConfirm(false)}>取消</button></div></div>}
      </div>
      <ImportPanel />
      <div className="panel"><h3>导出词库</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn sec" style={{ flex: 1 }} onClick={() => exportLib('csv')}>去重词库 CSV</button>
          <button className="btn sec" style={{ flex: 1 }} onClick={() => exportLib('json')}>JSON</button>
        </div>
        <button className="btn sec block" onClick={exportLessons}>课程记录 CSV（含每天条目）</button>
        <p className="sub">去重词库 {words.length} 词；课程记录 {lessons.reduce((a, l) => a + l.wordIds.length, 0)} 条。</p>
      </div>
      <div className="panel"><h3>发音音频</h3>
        <p className="sub">存档音频由服务器端生成并保存为 MP3。已检测（前200词）可用：{audioN === null ? '…' : `${audioN}`} 个。{audioN === 0 && '——目前服务器上还没有生成音频，请见部署说明。'}</p>
        <button className="btn sec block" onClick={downloadAudio}>下载全部音频供离线使用</button>
        {dl && <div className="note" role="status">{dl}</div>}
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}><input type="checkbox" style={{ width: 20 }} checked={settings.autoPlay} onChange={e => updateSettings({ autoPlay: e.target.checked })} /><span style={{ fontSize: 15, color: 'var(--ink)' }}>翻面时自动朗读</span></label>
      </div>
      <div className="panel"><h3>词库更新</h3>
        <p className="sub">在线时每次打开会自动合并服务器新增的每日课程（只新增，不覆盖你的词条与进度）。</p>
        <button className="btn sec block" onClick={refreshLib}>立即检查更新</button></div>
      <div className="panel"><h3>未接入</h3><p className="sub">账号登录与跨设备云同步尚未实现；请使用 JSON 备份在设备间迁移。</p></div>
    </>
  )
}
