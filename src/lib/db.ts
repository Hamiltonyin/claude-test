import { openDB, type IDBPDatabase } from 'idb'
import type { Word, Lesson, Progress, ReviewLog, Session, Settings } from '../types'

// 数据库版本只做「增量」升级，绝不清空任何 store，保证升级后学习进度保留。
const DB_NAME = 'thai30'
const DB_VERSION = 1
let dbp: Promise<IDBPDatabase> | null = null

export function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d, oldV) {
        if (oldV < 1) {
          d.createObjectStore('words', { keyPath: 'id' })
          d.createObjectStore('lessons', { keyPath: 'day' })
          d.createObjectStore('progress', { keyPath: 'wordId' })
          const logs = d.createObjectStore('logs', { keyPath: 'id' })
          logs.createIndex('date', 'date')
          d.createObjectStore('sessions', { keyPath: 'date' })
          d.createObjectStore('meta')
        }
      },
    })
  }
  return dbp
}

export async function loadAll() {
  const d = await db()
  const [words, lessons, progress, logs, sessions, settings] = await Promise.all([
    d.getAll('words') as Promise<Word[]>, d.getAll('lessons') as Promise<Lesson[]>,
    d.getAll('progress') as Promise<Progress[]>, d.getAll('logs') as Promise<ReviewLog[]>,
    d.getAll('sessions') as Promise<Session[]>, d.get('meta', 'settings') as Promise<Settings | undefined>,
  ])
  return { words, lessons, progress, logs, sessions, settings }
}
export async function put<T>(store: string, v: T, key?: IDBValidKey) {
  const d = await db(); await d.put(store, v, key)
}
export async function putMany<T>(store: string, vs: T[]) {
  const d = await db(); const tx = d.transaction(store, 'readwrite')
  await Promise.all([...vs.map(v => tx.store.put(v)), tx.done])
}
export async function clearStores(names: string[]) {
  const d = await db(); const tx = d.transaction(names, 'readwrite')
  await Promise.all([...names.map(n => tx.objectStore(n).clear()), tx.done])
}
export const saveSettings = (s: Settings) => put('meta', s, 'settings')
