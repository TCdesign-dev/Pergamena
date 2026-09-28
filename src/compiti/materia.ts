import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { apriDocumento, giaAperto, mappaDocumenti, soloPagine } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { compitiDi, segnaFatto, type Compito } from './deposito'

/*  I compiti di TUTTA la materia, non solo della pagina aperta.
 *
 *  Nascono in una pagina — quella della lezione in cui sono stati
 *  assegnati — ma si guardano tutti insieme, nella scheda, accanto
 *  alle date d'esame: è lì che si pianifica, e «cosa devo consegnare
 *  questa settimana» non è una domanda che riguarda una pagina sola.
 *
 *  Si leggono aprendo i documenti Yjs salvati in IndexedDB, come fa la
 *  ricerca: quello già aperto nell'editor si legge dov'è, gli altri si
 *  aprono, si leggono e si richiudono. */

export type CompitoDiPagina = Compito & { documentoId: string; pagina: string }

async function compitiDelDocumento(d: Documento): Promise<CompitoDiPagina[]> {
  const veste = (c: Compito) => ({ ...c, documentoId: d.id, pagina: d.titolo })

  const aperto = giaAperto(d.id)
  if (aperto) {
    await aperto.pronto
    return compitiDi(aperto.doc).map(veste)
  }

  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(`pergamena:doc:${d.id}`, doc)
  await p.whenSynced
  const fuori = compitiDi(doc).map(veste)
  await p.destroy()
  doc.destroy()
  return fuori
}

export async function compitiDellaMateria(quadernoId: string): Promise<CompitoDiPagina[]> {
  const pagine = [...mappaDocumenti.values()].filter((d) => d.quadernoId === quadernoId && soloPagine(d))
  const tutti = (await Promise.all(pagine.map(compitiDelDocumento))).flat()
  return tutti.sort((a, b) => {
    if (!a.fatto !== !b.fatto) return a.fatto ? 1 : -1
    if (a.fatto && b.fatto) return b.fatto - a.fatto
    if (!a.data !== !b.data) return a.data ? -1 : 1
    if (a.data && b.data && a.data !== b.data) return a.data < b.data ? -1 : 1
    return a.quando - b.quando
  })
}

const ascoltatori = new Set<() => void>()
const rimbalza = () => ascoltatori.forEach((f) => f())

/*  Spuntare un compito dalla scheda vuol dire scrivere nel documento
 *  della pagina in cui sta, che può non essere aperto: lo si apre, e
 *  resta aperto come se ci fossi andato. Scrivere su una copia usa e
 *  getta e richiuderla subito vorrebbe dire correre con IndexedDB. */
export async function segnaFattoInPagina(documentoId: string, id: string, fatto: boolean) {
  const voce = apriDocumento(documentoId)
  await voce.pronto
  segnaFatto(voce.doc, id, fatto)
  rimbalza()
}

/*  Si rilegge quando cambia l'indice dei documenti — una pagina nuova,
 *  una eliminata — e quando l'editor apre o chiude un documento. Per i
 *  compiti spuntati dal pannello basta il rimbalzo del documento
 *  aperto, che passa di qui. */
export function useCompitiMateria(quadernoId: string | null): CompitoDiPagina[] {
  const [elenco, setElenco] = useState<CompitoDiPagina[]>([])
  useEffect(() => {
    if (!quadernoId) { setElenco([]); return }
    let vivo = true
    const rileggi = () => { void compitiDellaMateria(quadernoId).then((c) => { if (vivo) setElenco(c) }) }
    rileggi()
    mappaDocumenti.observe(rileggi)
    ascoltatori.add(rileggi)
    return () => { vivo = false; mappaDocumenti.unobserve(rileggi); ascoltatori.delete(rileggi) }
  }, [quadernoId])
  return elenco
}
