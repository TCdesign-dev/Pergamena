import * as Y from 'yjs'
import { mappaDocumenti, mappaQuaderni } from '../documento/archivio'
import { leggiDocumento } from '../documento/leggi'
import { leggiRegistrazioni } from '../registrazione/voci'
import { immaginiDi } from '../immagini/riferimenti'
import { tutte } from '../immagini/deposito'
import { tr } from '../lingua/lingua'

/*  Quanto occupa cosa: materia per materia, pagina per pagina, lezione
 *  per lezione. Gli appunti pesano poco; le trascrizioni un po' di più
 *  (ogni parola ha i suoi tempi); l'audio e le immagini sono il grosso.
 *
 *  Le misure sono stime oneste, non contabilità: il documento Yjs si
 *  pesa intero, e la parte della trascrizione è il suo testo coi tempi. */

export type MisuraLezione = {
  id: string
  inizio: number
  frasi: number
  byteTrascrizione: number
  audio: boolean
  byteAudio: number
}

export type MisuraPagina = {
  id: string
  titolo: string
  byteAppunti: number
  byteImmagini: number
  immagini: number
  lezioni: MisuraLezione[]
}

export type MisuraMateria = { id: string; nome: string; colore: string; pagine: MisuraPagina[] }

export type Misure = {
  materie: MisuraMateria[]
  totali: { appunti: number; trascrizioni: number; audio: number; immagini: number }
  /** quanto usa il browser per Pergamena (IndexedDB e resto), se lo dice */
  browser: number | null
}

const conTempo = <T,>(p: Promise<T>, ms: number, riserva: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(riserva), ms))])

export const peso = (m: MisuraPagina) =>
  m.byteAppunti + m.byteImmagini + m.lezioni.reduce((s, l) => s + l.byteTrascrizione + l.byteAudio, 0)

export async function misuraTutto(): Promise<Misure> {
  // l'audio lo pesa il server; le immagini il deposito (che nel browser
  // dell'app a volte non risponde: allora si va avanti senza)
  const [pesiAudio, immagini, stima] = await Promise.all([
    fetch('/api/audio').then((r) => r.json() as Promise<Record<string, number>>).catch(() => ({} as Record<string, number>)),
    conTempo(tutte().then((v) => new Map(v.map((x) => [x.id, x.blob.size]))), 3000, new Map<string, number>()),
    navigator.storage?.estimate?.().catch(() => null) ?? Promise.resolve(null),
  ])

  const materie: MisuraMateria[] = []
  const totali = { appunti: 0, trascrizioni: 0, audio: 0, immagini: 0 }

  for (const q of mappaQuaderni.values()) {
    const pagine: MisuraPagina[] = []
    for (const d of [...mappaDocumenti.values()].filter((x) => x.quadernoId === q.id)) {
      const misura = await leggiDocumento(d.id, (doc) => {
        const tuttoIlDocumento = Y.encodeStateAsUpdate(doc).byteLength
        const lezioni = leggiRegistrazioni(doc).map((r) => ({
          id: r.id,
          inizio: r.inizio,
          frasi: r.segmenti.length,
          byteTrascrizione: new Blob([JSON.stringify(r.segmenti), JSON.stringify(r.ancore)]).size,
          audio: r.audio,
          byteAudio: pesiAudio[r.id] ?? 0,
        }))
        const ids = immaginiDi(doc)
        return {
          id: d.id,
          titolo: d.scheda ? tr('Scheda della materia') : d.titolo || tr('Senza titolo'),
          byteAppunti: Math.max(0, tuttoIlDocumento - lezioni.reduce((s, l) => s + l.byteTrascrizione, 0)),
          byteImmagini: ids.reduce((s, id) => s + (immagini.get(id) ?? 0), 0),
          immagini: ids.length,
          lezioni,
        }
      })
      pagine.push(misura)
      totali.appunti += misura.byteAppunti
      totali.immagini += misura.byteImmagini
      for (const l of misura.lezioni) { totali.trascrizioni += l.byteTrascrizione; totali.audio += l.byteAudio }
    }
    pagine.sort((a, b) => peso(b) - peso(a))
    materie.push({ id: q.id, nome: q.nome || tr('Senza nome'), colore: q.colore, pagine })
  }
  materie.sort((a, b) => b.pagine.reduce((s, p) => s + peso(p), 0) - a.pagine.reduce((s, p) => s + peso(p), 0))
  return { materie, totali, browser: stima?.usage ?? null }
}

export function quanto(byte: number) {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`
  return `${(byte / 1024 / 1024).toFixed(byte < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} MB`
}
