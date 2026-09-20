import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { nanoid } from 'nanoid'
import { COLORI } from '../stili/colori'
import { esponi } from '../lib/dev'
import { registraStanza, dimenticaStanza, cancellaStanzaRemota } from '../sync/sincronia'
import { immaginiDi } from '../immagini/riferimenti'
import { elimina as eliminaImmagine, salva as salvaImmagine } from '../immagini/deposito'
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

registraStanza('indice', indice)

export const mappaQuaderni = indice.getMap<Quaderno>('quaderni')
export const mappaDocumenti = indice.getMap<Documento>('documenti')

// ── Contenuto: un Y.Doc per documento, caricato su richiesta ───
const aperti = new Map<string, { doc: Y.Doc; pronto: Promise<unknown> }>()

/** Il documento già in memoria, se c'è. La ricerca lo usa per non
 *  riaprire da IndexedDB quello che sta sotto al cursore. */
export function giaAperto(id: string) {
  return aperti.get(id)
}

export function apriDocumento(id: string) {
  const esistente = aperti.get(id)
  if (esistente) return esistente

  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(`${PREFISSO}:doc:${id}`, doc)
  const voce = { doc, pronto: p.whenSynced }
  aperti.set(id, voce)
  // la sincronia parte da sola, se c'è un accesso attivo
  void voce.pronto.then(() => registraStanza(`doc:${id}`, doc))
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

/*  Eliminare una pagina deve eliminarla DAVVERO: il contenuto, le sue
 *  immagini (byte compresi, in locale e sul server) e la storia
 *  remota. Altrimenti lo spazio si riempie di roba che nessuno
 *  guarderà più, e al prossimo dispositivo la pagina ricomparirebbe.
 *
 *  In fase 3 qui si aggiungono registrazione e trascrizione. */
export async function eliminaDocumento(id: string) {
  // prima si legge quali immagini usa, finché il documento c'è ancora
  const voce = aperti.get(id) ?? apriDocumento(id)
  await voce.pronto
  const immagini = immaginiDi(voce.doc)

  dimenticaStanza(`doc:${id}`)
  mappaDocumenti.delete(id)

  voce.doc.destroy()
  aperti.delete(id)

  await Promise.allSettled([
    ...immagini.map((i) => eliminaImmagine(i)),
    cancellaStanzaRemota(`doc:${id}`),
    indexedDB.deleteDatabase(`${PREFISSO}:doc:${id}`),
  ])
}

export async function eliminaQuaderno(id: string) {
  const suoi = [...mappaDocumenti.values()].filter((d) => d.quadernoId === id)
  for (const d of suoi) await eliminaDocumento(d.id)

  const copertina = mappaQuaderni.get(id)?.copertinaId
  if (copertina) await eliminaImmagine(copertina).catch(() => {})

  mappaQuaderni.delete(id)
}

/** Mette (o sostituisce) la copertina di una materia. */
export async function impostaCopertina(quadernoId: string, blob: Blob, meta?: {
  attribuzione?: string
  licenza?: string
  origine?: string
}) {
  const q = mappaQuaderni.get(quadernoId)
  if (!q) return

  const nuova = await salvaImmagine(blob, {
    larghezza: 0,
    altezza: 0,
    origine: meta?.origine ?? '',
    attribuzione: meta?.attribuzione ?? '',
    licenza: meta?.licenza ?? '',
  })

  const vecchia = q.copertinaId
  mappaQuaderni.set(quadernoId, { ...q, copertinaId: nuova })
  if (vecchia) void eliminaImmagine(vecchia).catch(() => {})
}

export async function togliCopertina(quadernoId: string) {
  const q = mappaQuaderni.get(quadernoId)
  if (!q?.copertinaId) return
  const vecchia = q.copertinaId
  const { copertinaId: _, ...senza } = q
  mappaQuaderni.set(quadernoId, senza)
  void eliminaImmagine(vecchia).catch(() => {})
}

esponi({
  archivio: {
    creaQuaderno, creaDocumento, rinominaQuaderno, rinominaDocumento,
    eliminaDocumento, eliminaQuaderno, apriDocumento, mappaQuaderni, mappaDocumenti,
  },
})
