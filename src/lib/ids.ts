// 由泰文确定性生成词汇 ID：同一个词在任何设备/导入渠道都得到同一个 ID（因此共用进度与音频）
export function wordIdFor(thai: string): string {
  let h = 0x811c9dc5
  for (const ch of thai.normalize('NFC')) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0 }
  return 'u' + h.toString(16).padStart(8, '0')
}
