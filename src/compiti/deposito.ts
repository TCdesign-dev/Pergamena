import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { nanoid } from 'nanoid'
import { esponi } from '../lib/dev'

/*  I compiti che il professore ha assegnato a voce.
 *
 *  Stanno nel documento Yjs della pagina, come le lezioni, i commenti
 *  e le domande: si sincronizzano, si rileggono dal telefono e se ne
 *  vanno con la pagina. Li tira fuori l'integratore dalla
 *  trascrizione, insieme alle proposte — è la stessa chiamata, quindi
 *  non costano niente in più.
 *
 *  Uno spuntato non sparisce: resta barrato, in fondo. «L'avevo
 *  consegnato?» è una domanda che si fa tre settimane dopo, ed è metà
 *  del motivo per cui un elenco di compiti esiste. */

export type Compito = {
  id: string
  /** la cosa da fare, all'infinito: «consegnare le tavole del portico» */
  testo: string
  /** AAAA-MM-GG se ha nominato un giorno; un compito può non averlo */
  data?: string
  /** le sue parole, per riconoscere da dove viene */
  citazione?: string
  /** secondi dall'inizio della lezione, se la citazione si è ritrovata */
  minuto?: number
  /** la registrazione da cui viene */
  lezione?: string
  quando: number
  /** quando l'hai spuntato */
  fatto?: number
}

export function mappaCompiti(doc: Y.Doc) {
  return doc.getMap<Compito>('compiti')
}

/*  Prima quelli da fare, per data (senza data in fondo: non hanno una
 *  scadenza, non hanno fretta); poi quelli fatti, i più recenti in
 *  cima. */
export function compitiDi(doc: Y.Doc): Compito[] {
  return [...mappaCompiti(doc).values()].sort((a, b) => {
    if (!a.fatto !== !b.fatto) return a.fatto ? 1 : -1
    if (a.fatto && b.fatto) return b.fatto - a.fatto
    if (!a.data !== !b.data) return a.data ? -1 : 1
    if (a.data && b.data && a.data !== b.data) return a.data < b.data ? -1 : 1
    return a.quando - b.quando
  })
}

/*  Lo stesso compito detto in due lezioni, o due integrazioni della
 *  stessa lezione, non diventa due voci: si riconosce dal testo. */
const chiave = (testo: string) => testo.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, ' ').trim()

export function aggiungiCompiti(doc: Y.Doc, nuovi: Omit<Compito, 'id' | 'quando'>[]) {
  const mappa = mappaCompiti(doc)
  const gia = new Set([...mappa.values()].map((c) => chiave(c.testo)))
  let messi = 0
  doc.transact(() => {
    for (const c of nuovi) {
      const k = chiave(c.testo)
      if (!k || gia.has(k)) continue
      gia.add(k)
      const id = nanoid(10)
      mappa.set(id, { ...c, id, quando: Date.now() })
      messi++
    }
  })
  return messi
}

export function segnaFatto(doc: Y.Doc, id: string, fatto: boolean) {
  const mappa = mappaCompiti(doc)
  const c = mappa.get(id)
  if (!c) return
  const { fatto: _via, ...resto } = c
  mappa.set(id, fatto ? { ...resto, fatto: Date.now() } : resto)
}

export const togliCompito = (doc: Y.Doc, id: string) => mappaCompiti(doc).delete(id)

export function useCompiti(doc: Y.Doc | null): Compito[] {
  const [elenco, setElenco] = useState<Compito[]>(() => (doc ? compitiDi(doc) : []))
  useEffect(() => {
    if (!doc) { setElenco([]); return }
    const mappa = mappaCompiti(doc)
    const aggiorna = () => setElenco(compitiDi(doc))
    aggiorna()
    mappa.observe(aggiorna)
    return () => mappa.unobserve(aggiorna)
  }, [doc])
  return elenco
}

/** Quanti ne restano da fare: il numero sul pulsante. */
export const daFare = (compiti: Compito[]) => compiti.filter((c) => !c.fatto).length

esponi({ compiti: { compitiDi, aggiungiCompiti, segnaFatto, togliCompito } })
