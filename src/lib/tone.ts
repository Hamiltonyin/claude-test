// 拼音声调解析/校验：音节以 - 或空格分隔；声调符号：` 低 ^ 降 ´ 高 ˇ 升，无符号 = 中
const MARK: Record<string, string> = { '̀': 'L', '̂': 'F', '́': 'H', '̌': 'R' }
export const TONE_ZH: Record<string, string> = { M: '中调', L: '低调', F: '降调', H: '高调', R: '升调' }
export const TONE_SYMBOL: Record<string, string> = { M: '（无符号）', L: '`', F: 'ˆ', H: '´', R: 'ˇ' }

export function syllables(roman: string): string[] {
  return roman.trim().split(/[-\s]+/).filter(Boolean)
}
export function toneCodes(roman: string): string {
  return syllables(roman).map(s => {
    for (const ch of s.normalize('NFD')) if (MARK[ch]) return MARK[ch]
    return 'M'
  }).join('')
}
export function toneDescription(roman: string): { syl: string; code: string; name: string }[] {
  const codes = toneCodes(roman)
  return syllables(roman).map((syl, i) => ({ syl, code: codes[i], name: TONE_ZH[codes[i]] }))
}
export function toneSummary(roman: string): string {
  return toneDescription(roman).map(d => `${d.syl} ${d.name}`).join(' · ')
}
export const isThai = (s: string) => /^[฀-๿\s]+$/.test(s)
export const normThai = (s: string) => s.normalize('NFC').replace(/\s+/g, '').trim()

/** 校验一个词条，返回问题列表（空 = 通过） */
export function validateWord(w: { thai: string; roman: string; zh: string; exTh?: string }): string[] {
  const errs: string[] = []
  if (!w.thai) errs.push('缺少泰文')
  else if (!isThai(w.thai)) errs.push('泰文含非泰文字符')
  if (!w.zh) errs.push('缺少中文释义')
  if (!w.roman) errs.push('缺少拼音')
  else {
    if (/[฀-๿]/.test(w.roman)) errs.push('拼音中混入泰文')
    if (/[A-Z]/.test(w.roman[0] || '')) { /* 大写不报错 */ }
    const n = syllables(w.roman).length
    if (n === 0) errs.push('拼音无音节')
    // 中调音节无符号，所以只能检查「全部无符号但音节>1」之类的可疑情形
    if (n > 1 && /^[a-zɔɛəɯŋ\-\s]+$/i.test(w.roman.normalize('NFD').replace(/[̀-ͯ]/g, '')) && toneCodes(w.roman) === 'M'.repeat(n)) {
      /* 全中调：合法（如 raa-khaa），不报错 */
    }
  }
  if (w.exTh && !isThai(w.exTh)) errs.push('例句含非泰文字符')
  return errs
}
