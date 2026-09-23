import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { nanoid } from 'nanoid'
import type { Commento } from './tipi'

/*  I commenti di una pagina, dentro al suo documento Yjs. Ogni voce è
 *  un oggetto intero: per cambiarla la si riscrive, come le
 *  correzioni. */

export function mappaCommenti(doc: Y.Doc) {
  return doc.getMap<Commento>('commenti')
}

/** In ordine di quando li hai scritti. Nel pannello si rimettono in
 *  ordine di pagina, che è l'ordine in cui si rileggono. */
export function commentiDi(doc: Y.Doc): Commento[] {
  return [...mappaCommenti(doc).values()].sort((a, b) => a.quando - b.quando)
}

export function aggiungiCommento(doc: Y.Doc, dati: Omit<Commento, 'id' | 'quando'>): Commento {
  const nuovo: Commento = { ...dati, id: nanoid(10), quando: Date.now() }
  mappaCommenti(doc).set(nuovo.id, nuovo)
  return nuovo
}

export function aggiornaCommento(doc: Y.Doc, id: string, testo: string) {
  const c = mappaCommenti(doc).get(id)
  if (c && c.testo !== testo) mappaCommenti(doc).set(id, { ...c, testo, modificato: Date.now() })
}

export function togliCommento(doc: Y.Doc, id: string) {
  mappaCommenti(doc).delete(id)
}

/** Si ridisegna quando cambiano i commenti della pagina. */
export function useCommenti(doc: Y.Doc | null): Commento[] {
  const [elenco, setElenco] = useState<Commento[]>(() => (doc ? commentiDi(doc) : []))
  useEffect(() => {
    if (!doc) { setElenco([]); return }
    const mappa = mappaCommenti(doc)
    const aggiorna = () => setElenco(commentiDi(doc))
    aggiorna()
    mappa.observe(aggiorna)
    return () => mappa.unobserve(aggiorna)
  }, [doc])
  return elenco
}
