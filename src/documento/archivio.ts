import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { nanoid } from 'nanoid'
import { COLORI } from '../stili/colori'
import type { Quaderno, Documento } from './tipi'

/*  Tutto è Yjs, anche l'indice.
 *
 *  Sembra eccessivo per un'app locale, ma è la scelta che in fase 1
 *  fa comparire la sincronizzazione quasi gratis: lo stesso documento
 *  che qui vive in IndexedDB verrà replicato sul server senza cambiare
 *  una riga di questo file. E ci dà l'undo che sopravvive alle
 *  modifiche dell'AI mentre stai scrivendo. */

const PREFISSO = 'pergamena'

// ── Indice: l'elenco dei quaderni e dei documenti ──────────────
export const indice = new Y.Doc()
const persistenzaIndice = new IndexeddbPersistence(`${PREFISSO}:indice`, indice)
export const prontoIndice = persistenzaIndice.whenSynced

export const mappaQuaderni = indice.getMap<Quaderno>('quaderni')
export const mappaDocumenti = indice.getMap<Documento>('documenti')

// ── Contenuto: un Y.Doc per documento, caricato su richiesta ───
const aperti = new Map<string, { doc: Y.Doc; pronto: Promise<unknown> }>()

export function apriDocumento(id: string) {
  const esistente = aperti.get(id)
  if (esistente) return esistente

  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(`${PREFISSO}:doc:${id}`, doc)
  const voce = { doc, pronto: p.whenSynced }
  aperti.set(id, voce)
  return voce
}

// ── Scritture ──────────────────────────────────────────────────
export function creaQuaderno(nome: string): Quaderno {
  const q: Quaderno = {
    id: nanoid(10),
    nome,
    colore: COLORI[mappaQuaderni.size % COLORI.length],
    creato: Date.now(),
  }
  mappaQuaderni.set(q.id, q)
  return q
}

/** Nasce senza titolo: il segnaposto è UI, non un dato da salvare. */
export function creaDocumento(quadernoId: string, titolo = ''): Documento {
  const d: Documento = {
    id: nanoid(10),
    quadernoId,
    titolo,
    creato: Date.now(),
    modificato: Date.now(),
  }
  mappaDocumenti.set(d.id, d)
  return d
}

export function rinominaDocumento(id: string, titolo: string) {
  const d = mappaDocumenti.get(id)
  if (d) mappaDocumenti.set(id, { ...d, titolo, modificato: Date.now() })
}

export function segnaModificato(id: string) {
  const d = mappaDocumenti.get(id)
  if (d) mappaDocumenti.set(id, { ...d, modificato: Date.now() })
}

export function rinominaQuaderno(id: string, nome: string) {
  const q = mappaQuaderni.get(id)
  if (q) mappaQuaderni.set(id, { ...q, nome })
}

/** Elimina documento e contenuto. In fase 4 questo diventa il
 *  gestore dell'archivio: cancella anche audio e trascrizione. */
export async function eliminaDocumento(id: string) {
  mappaDocumenti.delete(id)
  aperti.get(id)?.doc.destroy()
  aperti.delete(id)
  await indexedDB.deleteDatabase(`${PREFISSO}:doc:${id}`)
}

export async function eliminaQuaderno(id: string) {
  const suoi = [...mappaDocumenti.values()].filter((d) => d.quadernoId === id)
  for (const d of suoi) await eliminaDocumento(d.id)
  mappaQuaderni.delete(id)
}
