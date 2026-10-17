import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { downloadAll, hasFile } from '../lib/audio'
import { today } from '../lib/dates'
import type { Backup } from '../types'

function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })
const isBackup = (j: any): j is Backup => j && j.app === 'nihongo' && Array.isArray(j.words) && Array.isArray(j.progress)

export default function Me() {
  const { exportBackup, restoreBackup, words, settings, updateSettings, mergeLibrary, rebuildSession } = useApp()
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [dl, setDl] = useState<string | null>(null)
  const [audioN, setAudioN] = useState<number | null>(null)
  const [persist, setPersist] = useState('检测中…')
  const pending = useRef<any>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    (async () => { const ok = await Promise.all(words.slice(0, 200).map(w => hasFile(w.id))); setAudioN(ok.filter(Boolean).length) })()
    navigator.storage?.persisted?.().then(p => setPersist(p ? '已启用（浏览器不会自动清理）' : '未授予（添加到主屏幕后更可靠；请定期备份）')).catch(() => setPersist('无法检测'))
  }, [words.length])

  const backup = () => {
    const b = exportBackup()
    saveFile(`nihongo-backup-${today()}.json`, JSON.stringify(b), 'application/json')
    updateSettings({ lastBackupAt: Date.now() })
    setMsg({ t: 'ok', s: `已导出备份（${b.words.length} 张卡片，${b.progress.length} 条进度，${b.logs.length} 条复习日志）。请保存到「文件」或 iCloud。` })
  }
  const onRestore = async (f: File) => {
    try { const j = JSON.parse(await readFile(f)); if (!isBackup(j)) throw new Error('不是「职场日语」的备份文件'); pending.current = j; setConfirm(true); setMsg(null) }
    catch (e: any) { setMsg({ t: 'err', s: '读取备份失败：' + e.message }) }
  }
  const doRestore = async (mode: 'replace' | 'merge') => {
    try { await restoreBackup(pending.current, mode); await rebuildSession(); setMsg({ t: 'ok', s: mode === 'replace' ? '已用备份覆盖当前数据。' : '已合并备份（进度取较新者）。' }) }
    catch (e: any) { setMsg({ t: 'err', s: '恢复失败：' + e.message }) }
    setConfirm(false)
  }
  const downloadAudio = async () => {
    setDl('下载中…')
    const r = await downloadAll(words.map(w => w.id), (d, f) => setDl(`下载中 ${d}/${words.length}（失败 ${f}）`))
    setDl(r.fail ? `完成，但有 ${r.fail} 张卡片没有音频文件（服务器尚未生成）。` : `全部 ${r.done} 个音频已缓存，可离线播放。`)
  }
  const refreshLib = async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}content/library.json`, { cache: 'no-cache' })
      if (!r.ok) throw new Error('服务器无更新（' + r.status + '）')
      const j = await r.json(); const n = await mergeLibrary(j.words, j.lessons ?? []); await rebuildSession()
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
        {confirm && <div className="note">选择恢复方式：「合并」保留现有数据，进度取较新者（推荐）；「覆盖」用备份替换全部数据。
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn" onClick={() => doRestore('merge')}>合并</button><button className="btn danger" onClick={() => doRestore('replace')}>覆盖</button><button className="btn sec" onClick={() => setConfirm(false)}>取消</button></div></div>}
      </div>
      <div className="panel"><h3>发音音频</h3>
        <p className="sub">存档音频由服务器端生成并保存为 MP3。已检测（前200张）可用：{audioN === null ? '…' : audioN} 个。{audioN === 0 && '——目前服务器上还没有生成音频。'}</p>
        <button className="btn sec block" onClick={downloadAudio}>下载全部音频供离线使用</button>
        {dl && <div className="note" role="status">{dl}</div>}
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}><input type="checkbox" style={{ width: 20 }} checked={settings.autoPlay} onChange={e => updateSettings({ autoPlay: e.target.checked })} /><span style={{ fontSize: 15, color: 'var(--ink)' }}>翻面时自动朗读</span></label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}><input type="checkbox" style={{ width: 20 }} checked={settings.requeueStrange !== false} onChange={e => updateSettings({ requeueStrange: e.target.checked })} /><span style={{ fontSize: 15, color: 'var(--ink)' }}>评为「陌生」的卡，本轮稍后再出现一次（会标注「再看一遍」）</span></label>
      </div>
      <div className="panel"><h3>内容更新</h3>
        <p className="sub">在线时每次打开会自动合并服务器新增的课程（只新增，不覆盖你的进度）。</p>
        <button className="btn sec block" onClick={refreshLib}>立即检查更新</button></div>
      <div className="panel"><h3>说明</h3><p className="sub">这是「职场日语」，与「泰语每日30词」是两个独立应用，学习数据互不影响。账号登录与云同步尚未实现；请用 JSON 备份迁移设备。</p></div>
    </>
  )
}
