import { useEffect, useState } from 'react'
import { indice } from '../documento/archivio'

/*  Com'è andato l'ultimo quiz, per argomento e per materia.
 *
 *  Sta nell'indice (Yjs, sincronizzato): il ripasso fatto sul Mac si
 *  ritrova ovunque. Si tiene solo l'ultimo esito e quante volte: serve
 *  a dire «da ripassare», non a fare statistiche. */

export type Esito = { quando: number; giuste: number; totale: number; volte: number }

const mappa = indice.getMap<Esito>('ripasso')

export function segnaEsito(chiave: string, giuste: number, totale: number) {
  if (!totale) return
  const prima = mappa.get(chiave)
  mappa.set(chiave, { quando: Date.now(), giuste, totale, volte: (prima?.volte ?? 0) + 1 })
}

const GIORNI_7 = 7 * 24 * 3600 * 1000

/** Da ripassare: mai fatto, meno di sette su dieci, o più di una
 *  settimana fa. */
export function daRipassare(e: Esito | undefined) {
  if (!e) return true
  return e.giuste / e.totale < 0.7 || Date.now() - e.quando > GIORNI_7
}

export function useEsiti() {
  const [esiti, setEsiti] = useState(() => new Map(mappa.entries()))
  useEffect(() => {
    const aggiorna = () => setEsiti(new Map(mappa.entries()))
    mappa.observe(aggiorna)
    return () => mappa.unobserve(aggiorna)
  }, [])
  return esiti
}
