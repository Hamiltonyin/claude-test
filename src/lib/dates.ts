export const pad = (n: number) => String(n).padStart(2, '0')
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return today(new Date(y, m - 1, d + n))
}
export function diffDays(a: string, b: string): number {
  const f = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((f(a) - f(b)) / 86400000)
}
