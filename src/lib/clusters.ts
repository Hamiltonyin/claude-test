/** 关联词：近义/反义/同类的词放在一起（content/categories.json 里 cluster 那一组）。 */
export interface Cluster { id: string; name: string; emoji: string; words: string[] }
let cache: Promise<Cluster[]> | null = null
export const loadClusters = (): Promise<Cluster[]> => (cache ??= fetch(`${import.meta.env.BASE_URL}content/categories.json`)
  .then(r => r.ok ? r.json() : { groups: [] })
  .then(j => ((j.groups as { cluster?: boolean; cats: Cluster[] }[]).find(g => g.cluster)?.cats ?? []))
  .catch(() => { cache = null; return [] }))
