import type * as Y from 'yjs'
import type { Segmento } from '../registrazione/tipi'
import { avviatoDi, chiave } from '../registrazione/voci'

/*  Quello che il professore ha detto negli ultimi 90 secondi: le frasi
 *  già chiuse dal riconoscitore, più quella che si sta ancora formando.
 *  Chi scrive una data la scrive mentre la sente, spesso prima che il
 *  riconoscitore chiuda la frase alla pausa successiva. */

export const FINESTRA = 90   // secondi

export function finestraDi(voce: Y.Map<unknown>, provvisorio: string, adesso = Date.now()) {
  const t = (adesso - avviatoDi(voce)) / 1000
  const visti = new Set<string>()
  const frasi = ((voce.get('segmenti') as Y.Array<Segmento> | undefined)?.toArray() ?? [])
    .filter((s) => s.fine >= t - FINESTRA && !visti.has(chiave(s)) && visti.add(chiave(s)))
    .map((s) => s.testo.trim())
  if (provvisorio.trim()) frasi.push(provvisorio.trim())
  const testo = frasi.join(' ')
  return { testo, t, parole: testo.split(/\s+/).filter(Boolean).length }
}
