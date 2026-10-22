/** 朗读中文意思前的清理：取第一个意思、去掉括号注释。必须与 scripts/gen_audio.py 的 clean_zh 保持一致。 */
export function zhSpeakText(zh: string): string {
  const first = zh.split(/[；;]/)[0]
  const t = first.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/……/g, '某某').replace(/…/g, '某某').trim()
  return t || zh.replace(/[（）()]/g, '').trim()
}
