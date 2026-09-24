import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { nanoid } from 'nanoid'

/*  Le domande fatte alla lezione, con le loro risposte.
 *
 *  Stanno nel documento Yjs della pagina, come le lezioni e i
 *  commenti: si sincronizzano, si rileggono dal telefono e se ne vanno
 *  con la pagina. Una domanda fatta a ottobre è ancora lì a gennaio,
 *  quando ripassi — ed è metà del valore della cosa. */

export type Domanda = {
  id: string
  domanda: string
  risposta: string
  quando: number
  /** quante lezioni ha letto per rispondere */
  lezioni: number
  costo: number
}

export function mappaDomande(doc: Y.Doc) {
  return doc.getMap<Domanda>('domande')
}

export function domandeDi(doc: Y.Doc): Domanda[] {
  return [...mappaDomande(doc).values()].sort((a, b) => a.quando - b.quando)
}

export function aggiungiDomanda(doc: Y.Doc, dati: Omit<Domanda, 'id' | 'quando'>): Domanda {
  const nuova: Domanda = { ...dati, id: nanoid(10), quando: Date.now() }
  mappaDomande(doc).set(nuova.id, nuova)
  return nuova
}

export const togliDomanda = (doc: Y.Doc, id: string) => mappaDomande(doc).delete(id)

export function svuotaDomande(doc: Y.Doc) {
  const mappa = mappaDomande(doc)
  doc.transact(() => { for (const id of [...mappa.keys()]) mappa.delete(id) })
}

export function useDomande(doc: Y.Doc | null): Domanda[] {
  const [elenco, setElenco] = useState<Domanda[]>(() => (doc ? domandeDi(doc) : []))
  useEffect(() => {
    if (!doc) { setElenco([]); return }
    const mappa = mappaDomande(doc)
    const aggiorna = () => setElenco(domandeDi(doc))
    aggiorna()
    mappa.observe(aggiorna)
    return () => mappa.unobserve(aggiorna)
  }, [doc])
  return elenco
}
