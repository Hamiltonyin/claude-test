/** 成就：全部由现有数据算出来（连续天数、掌握词数、翻卡/听读次数…），不用额外存档；
 *  「已解锁过哪些」另存一份，用来在新解锁时庆祝一次。 */
export type BadgeKind = 'streak' | 'learned' | 'mastered' | 'perfect' | 'flips' | 'listens' | 'reviews'
export interface Stats { streak: number; learned: number; mastered: number; perfect: number; flips: number; listens: number; reviews: number }
export interface Badge { id: string; kind: BadgeKind; need: number; emoji: string; title: string; desc: string }

const defs: [BadgeKind, string, number[], (n: number) => string, (n: number) => string][] = [
  ['streak', '🔥', [3, 7, 14, 30, 60, 100], n => `连续 ${n} 天`, n => `连续 ${n} 天都有学习`],
  ['learned', '📚', [50, 100, 200, 300, 500, 650], n => `学过 ${n} 词`, n => `累计学过 ${n} 个词`],
  ['mastered', '🏅', [10, 50, 100, 200, 300, 500], n => `掌握 ${n} 词`, n => `${n} 个词达到熟悉以上`],
  ['perfect', '🌟', [5, 20, 50, 100, 200], n => `精通 ${n} 词`, n => `${n} 个词达到精通`],
  ['flips', '🃏', [50, 200, 500, 1000, 3000], n => `翻卡 ${n} 次`, n => `累计翻卡 ${n} 次`],
  ['listens', '🎧', [100, 500, 1000, 3000], n => `听读 ${n} 次`, n => `单词和例句累计听了 ${n} 次`],
  ['reviews', '🔁', [100, 500, 1000, 3000], n => `评级 ${n} 次`, n => `累计复习评级 ${n} 次`],
]
export const BADGES: Badge[] = defs.flatMap(([kind, emoji, needs, title, desc]) => needs.map(need => ({ id: `${kind}-${need}`, kind, need, emoji, title: title(need), desc: desc(need) })))

export interface BadgeState extends Badge { cur: number; earned: boolean }
export function evaluate(s: Stats) {
  const all: BadgeState[] = BADGES.map(b => ({ ...b, cur: s[b.kind], earned: s[b.kind] >= b.need }))
  const earned = all.filter(b => b.earned)
  // 每类只显示「下一个」未解锁的
  const next: BadgeState[] = []
  for (const k of new Set(BADGES.map(b => b.kind))) { const n = all.find(b => b.kind === k && !b.earned); if (n) next.push(n) }
  // 离解锁最近的那个（进度比例最高）
  const nearest = [...next].sort((a, b) => b.cur / b.need - a.cur / a.need)[0]
  return { all, earned, next, nearest }
}
/** 新解锁的：每类只取最高档，最多 3 个，方便一次性庆祝 */
export function newlyUnlocked(earned: BadgeState[], seen: Set<string>): BadgeState[] {
  const fresh = earned.filter(b => !seen.has(b.id))
  const top = new Map<string, BadgeState>()
  for (const b of fresh) { const t = top.get(b.kind); if (!t || b.need > t.need) top.set(b.kind, b) }
  return [...top.values()].slice(0, 3)
}
