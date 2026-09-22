import type * as Y from 'yjs'
import { nanoid } from 'nanoid'
import { normalizza } from '../lib/testo'
import type { Correzione, StatoCorrezione } from './tipi'

/*  Le correzioni di una pagina, dentro al suo documento Yjs. Ogni voce
 *  è un oggetto intero: per cambiarle stato la si riscrive. */

export function mappaCorrezioni(doc: Y.Doc) {
  return doc.getMap<Correzione>('correzioni')
}

export function correzioniDi(doc: Y.Doc): Correzione[] {
  return [...mappaCorrezioni(doc).values()].sort((a, b) => a.quando - b.quando)
}

export function inAttesa(doc: Y.Doc, blocco?: string) {
  return correzioniDi(doc).filter((c) => c.stato === 'proposta' && (!blocco || c.blocco === blocco))
}

const stessa = (a: string, b: string) => normalizza(a).trim() === normalizza(b).trim()

/*  Una correzione già vista non torna: né quella che hai lasciato
 *  com'era, né una seconda sullo stesso pezzo mentre la prima aspetta. */
function giaVista(doc: Y.Doc, c: Pick<Correzione, 'blocco' | 'prima' | 'dopo'>) {
  return correzioniDi(doc).some((v) => v.blocco === c.blocco && stessa(v.prima, c.prima)
    && (stessa(v.dopo, c.dopo) || v.stato === 'proposta'))
}

export function aggiungiCorrezione(doc: Y.Doc, c: Omit<Correzione, 'id' | 'stato' | 'quando'>) {
  if (giaVista(doc, c)) return null
  const nuova: Correzione = { ...c, id: nanoid(10), stato: 'proposta', quando: Date.now() }
  mappaCorrezioni(doc).set(nuova.id, nuova)
  return nuova
}

export function segnaCorrezione(doc: Y.Doc, id: string, stato: StatoCorrezione) {
  const c = mappaCorrezioni(doc).get(id)
  if (c && c.stato !== stato) mappaCorrezioni(doc).set(id, { ...c, stato })
}

/** Con la lezione se ne vanno anche le sue correzioni ancora aperte:
 *  resterebbero pallini a margine di una lezione che non c'è più. */
export function togliCorrezioniDi(doc: Y.Doc, registrazione: string) {
  const mappa = mappaCorrezioni(doc)
  doc.transact(() => {
    for (const c of [...mappa.values()]) {
      if (c.registrazione === registrazione && c.stato === 'proposta') mappa.delete(c.id)
    }
  })
}
