import type { Word, Lesson, Backup } from '../types'
import { parseCSV, CSV_HEADER } from './csv'
import { normThai, toneSummary, validateWord } from './tone'
import { wordIdFor } from './ids'

export interface Row { key: number; day?: number; thai: string; roman: string; zh: string; theme: string; exTh: string; exRoman: string; exZh: string }
export interface CheckedRow extends Row { errors: string[]; dup: 'none' | 'library' | 'batch'; existingId?: string }

/** 把 CSV 或 JSON 文本解析成待审核行（支持：词条数组、{words,lessons} 或完整备份） */
export function parseEntries(text: string): Row[] {
  const t = text.trim()
  let raw: any[] = []
  if (t.startsWith('[') || t.startsWith('{')) {
    const j = JSON.parse(t)
    if (Array.isArray(j)) raw = j
    else if (j.words) {
      const dayOf = new Map<string, number>()
      for (const l of (j.lessons ?? []) as Lesson[]) for (const id of l.wordIds) if (!dayOf.has(id)) dayOf.set(id, l.day)
      raw = (j.words as Word[]).map(w => ({ ...w, day: dayOf.get(w.id) }))
    } else throw new Error('JSON 格式不识别：需要数组或含 words 的对象')
  } else {
    const rows = parseCSV(t)
    if (!rows.length) return []
    const head = rows[0].map(h => h.trim())
    const hasHead = head.includes('thai')
    const cols = hasHead ? head : CSV_HEADER
    raw = rows.slice(hasHead ? 1 : 0).map(r => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()])))
  }
  return raw.map((r, i) => ({
    key: i, day: r.day ? Number(r.day) || undefined : undefined,
    thai: normThai(String(r.thai ?? '')), roman: String(r.roman ?? '').normalize('NFC').trim(),
    zh: String(r.zh ?? '').trim(), theme: String(r.theme ?? '日常交流').trim() || '日常交流',
    exTh: String(r.exTh ?? '').trim(), exRoman: String(r.exRoman ?? '').normalize('NFC').trim(), exZh: String(r.exZh ?? '').trim(),
  }))
}

/** 校验：泰文字符、拼音声调、必填项；检查与词库/本批次内重复 */
export function checkRows(rows: Row[], library: Word[]): CheckedRow[] {
  const byThai = new Map(library.map(w => [w.thai, w.id]))
  const seen = new Set<string>()
  return rows.map(r => {
    const errors = validateWord(r)
    const existingId = byThai.get(r.thai)
    let dup: CheckedRow['dup'] = 'none'
    if (existingId) dup = 'library'
    else if (seen.has(r.thai)) dup = 'batch'
    seen.add(r.thai)
    // 已在词库中的词无需再校验完整性（只用于把它加入某天课程）
    return { ...r, errors: existingId ? [] : errors, dup, existingId }
  })
}

export function toWord(r: Row): Word {
  return { id: wordIdFor(r.thai), thai: r.thai, roman: r.roman, tones: toneSummary(r.roman), zh: r.zh, theme: r.theme, exTh: r.exTh, exRoman: r.exRoman, exZh: r.exZh, createdAt: Date.now() }
}

export function isBackup(j: any): j is Backup { return j && j.app === 'thai30' && Array.isArray(j.words) && Array.isArray(j.progress) }
