import type { Esame, Quaderno } from '../documento/tipi'
import { locale, tr } from '../lingua/lingua'

/*  Le date d'esame sono giorni, non istanti: si confrontano come
 *  giorni di calendario locali, così un esame «domani» resta domani
 *  a qualunque ora tu lo guardi, e mezzanotte non sposta niente. */

function oggi() {
  const d = new Date()
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

function giorno(data: string) {
  const [a, m, g] = data.split('-').map(Number)
  return Date.UTC(a, (m || 1) - 1, g || 1)
}

/** Giorni che mancano: 0 oggi, 1 domani, negativo se è passato. */
export function mancano(data: string) {
  return Math.round((giorno(data) - oggi()) / 86_400_000)
}

export function comeDetto(data: string) {
  const n = mancano(data)
  if (n === 0) return tr('oggi')
  if (n === 1) return tr('domani')
  if (n > 1) return `fra ${n} giorni`
  if (n === -1) return 'ieri'
  return tr('{n} giorno fa | {n} giorni fa', { n: -n })
}

export function dataBreve(data: string) {
  const [a, m, g] = data.split('-').map(Number)
  if (!a || !m || !g) return data
  const quando = new Date(a, m - 1, g)
  const stessoAnno = a === new Date().getFullYear()
  return quando.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(stessoAnno ? {} : { year: 'numeric' }) })
}

/** Il prossimo esame non ancora passato, se c'è. */
export function prossimoEsame(q: Quaderno): Esame | null {
  return (q.esami ?? [])
    .filter((e) => e.data && mancano(e.data) >= 0)
    .sort((a, b) => a.data.localeCompare(b.data))[0] ?? null
}

/** Esami in ordine di data, i passati in fondo. */
export function inOrdine(esami: Esame[] = []) {
  return [...esami].sort((a, b) => {
    const pa = a.data ? mancano(a.data) < 0 : true
    const pb = b.data ? mancano(b.data) < 0 : true
    if (pa !== pb) return pa ? 1 : -1
    return (a.data || '9').localeCompare(b.data || '9')
  })
}
