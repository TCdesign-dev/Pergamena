/** «adesso», «12 min fa», «alle 9:40», «il 3/10 alle 9:40». */
import { locale, tr } from '../lingua/lingua'
export function quandoFa(ms: number) {
  const minuti = Math.round((Date.now() - ms) / 60_000)
  if (minuti < 1) return tr('adesso')
  if (minuti < 60) return tr('{n} min fa', { n: minuti })
  const d = new Date(ms)
  const ora = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  return new Date().toDateString() === d.toDateString()
    ? tr('alle {ora}', { ora })
    : tr('il {data} alle {ora}', { data: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), ora })
}
