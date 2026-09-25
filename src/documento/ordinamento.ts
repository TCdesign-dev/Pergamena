import type { Documento } from './tipi'
import { tr } from '../lingua/lingua'

export type Ordine = 'modifica' | 'creazione' | 'titolo'

export const ORDINI: Ordine[] = ['modifica', 'creazione', 'titolo']

export const ETICHETTE_ORDINE: Record<Ordine, string> = {
  modifica: tr('ultima modifica'),
  creazione: tr('data di creazione'),
  titolo: 'titolo',
}

const CHIAVE = 'pergamena:ordine'

export function leggiOrdine(): Ordine {
  try {
    const v = localStorage.getItem(CHIAVE) as Ordine | null
    if (v && ORDINI.includes(v)) return v
  } catch { /* finestra privata */ }
  return 'modifica'
}

export function salvaOrdine(o: Ordine) {
  try { localStorage.setItem(CHIAVE, o) } catch { /* pazienza */ }
}

/*  Lo spareggio sull'id non è pedanteria: due documenti creati nello
 *  stesso millisecondo, o non più toccati da quando sono nati, hanno
 *  lo stesso timestamp. Senza un secondo criterio l'ordine fra loro è
 *  arbitrario e la barra laterale si rimescola da sola a ogni
 *  ridisegno. */
export function ordina(documenti: Documento[], o: Ordine): Documento[] {
  const copia = [...documenti]
  const titolo = (d: Documento) => d.titolo || tr('Senza titolo')

  switch (o) {
    case 'creazione':
      return copia.sort((a, b) => b.creato - a.creato || a.id.localeCompare(b.id))
    case 'titolo':
      return copia.sort(
        (a, b) => titolo(a).localeCompare(titolo(b), 'it') || a.id.localeCompare(b.id),
      )
    default:
      return copia.sort((a, b) => b.modificato - a.modificato || a.id.localeCompare(b.id))
  }
}
