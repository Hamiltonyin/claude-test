// 强制更新：iPhone 主屏幕 App 的 Service Worker 有时很久都不换新版本。
// 这里绕开它：直接问服务器 version.json（不走缓存），和 App 内置的版本号不同，就提示 / 自动换成新版本。
declare const __BUILD_ID__: string
export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
const base = import.meta.env.BASE_URL

export async function latestId(): Promise<string | null> {
  try { const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return null; return (await r.json()).id ?? null } catch { return null }
}

/** 换成新版本：注销本 App 的 Service Worker、清掉它的程序缓存（音频缓存保留），再带上 ?v=新版本号 重新打开
 *  （带参数是为了绕开浏览器对首页的缓存；同一个版本 10 分钟内只自动试一次，避免反复刷新） */
export async function applyUpdate(id?: string) {
  try { localStorage.setItem('thai30-upd', JSON.stringify({ id, t: Date.now() })) } catch { /* 无痕模式 */ }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    for (const r of regs) if (!/\/(jp|en)\/$/.test(r.scope)) await r.unregister()   // 同站点的日语、英语 App 有自己的 SW，不动
    for (const k of (await caches?.keys?.()) ?? []) if (!k.includes('audio') && !k.includes('/jp/') && !k.includes('/en/')) await caches.delete(k)
  } catch { /* 浏览器不支持也没关系，直接刷新 */ }
  const u = new URL(location.href); u.searchParams.set('v', id || String(Date.now())); location.replace(u.toString())
}

/** 启动和回到前台时检查。发现新版本：刚打开 App 时直接换；用着用着发现的，就发一个事件让页面显示「有新版本」条 */
export function watchUpdates() {
  if (BUILD_ID === 'dev') return
  const started = Date.now()
  const check = async () => {
    const id = await latestId()
    if (!id || id === BUILD_ID) return
    let tried: { id?: string; t?: number } = {}
    try { tried = JSON.parse(localStorage.getItem('thai30-upd') || '{}') } catch { /* 无痕模式 */ }
    const recent = tried.id === id && Date.now() - (tried.t ?? 0) < 10 * 60 * 1000
    if (Date.now() - started < 4000 && !recent) return applyUpdate(id)
    window.dispatchEvent(new CustomEvent('thai30-update', { detail: id }))
  }
  void check()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check() })
  setInterval(() => void check(), 30 * 60 * 1000)
}
