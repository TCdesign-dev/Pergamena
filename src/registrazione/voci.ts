import * as Y from 'yjs'
import type { Segmento, Ancora, Pausa, Registrazione } from './tipi'

/*  La voce di una registrazione dentro al documento Yjs: leggerla,
 *  chiuderla, segnarci le pause. Niente server e niente interfaccia:
 *  solo il documento, così lo usano sia chi registra sia chi recupera. */

/** La mappa delle registrazioni di un documento. */
export function mappaRegistrazioni(doc: Y.Doc) {
  return doc.getMap<Y.Map<unknown>>('registrazioni')
}

export const chiave = (s: { inizio: number; testo: string }) => `${s.inizio.toFixed(2)}|${s.testo}`

/*  Le frasi doppie non si leggono mai. Non dovrebbero esserci — c'è uno
 *  scrivente solo — ma se due pagine le avessero scritte insieme, qui
 *  il merge, la trascrizione e il conto delle frasi restano giusti. */
function senzaDoppioni(segmenti: Segmento[]) {
  const visti = new Set<string>()
  return segmenti.filter((s) => !visti.has(chiave(s)) && visti.add(chiave(s)))
}

/** Lettura comoda di tutte le registrazioni di un documento. */
export function leggiRegistrazioni(doc: Y.Doc): Registrazione[] {
  const elenco: Registrazione[] = []
  mappaRegistrazioni(doc).forEach((m, id) => {
    elenco.push({
      id,
      inizio: m.get('inizio') as number,
      fine: (m.get('fine') as number | null) ?? null,
      audio: Boolean(m.get('audio')),
      segmenti: senzaDoppioni((m.get('segmenti') as Y.Array<Segmento>)?.toArray() ?? []),
      ancore: ((m.get('ancore') as Y.Array<Ancora>)?.toArray() ?? []),
      integrata: (m.get('integrata') as number | null) ?? null,
      insieme: (m.get('insieme') as number | null) ?? null,
      interrotta: Boolean(m.get('interrotta')),
      pause: ((m.get('pause') as Y.Array<Pausa>)?.toArray() ?? []),
    })
  })
  return elenco.sort((a, b) => a.inizio - b.inizio)
}

/** Il tempo zero: quando il microfono è partito davvero. */
export const avviatoDi = (voce: Y.Map<unknown>) =>
  (voce.get('avviato') as number | undefined) ?? (voce.get('inizio') as number)

const secondi = (voce: Y.Map<unknown>, ms: number) => Math.round((ms - avviatoDi(voce)) / 100) / 10

/** Quando è finita davvero: all'ultima frase, non quando ce ne si accorge. */
export function fineDa(voce: Y.Map<unknown>) {
  const segmenti = voce.get('segmenti') as Y.Array<Segmento>
  return segmenti.length ? avviatoDi(voce) + Math.round(segmenti.get(segmenti.length - 1).fine * 1000) : Date.now()
}

export function togli(voce: Y.Map<unknown>) {
  const doc = voce.doc
  if (!doc) return
  mappaRegistrazioni(doc).forEach((v, k) => { if (v === voce) mappaRegistrazioni(doc).delete(k) })
}

/** Una registrazione senza nemmeno una frase non resta: sarebbe una
 *  lezione vuota. Le altre si chiudono all'ultima frase — e senza le
 *  frasi doppie, se due pagine si sono passate la mano a metà. */
export function chiudiVoce(voce: Y.Map<unknown>, interrotta: boolean, errore: string | null = null, quando?: number) {
  const segmenti = voce.get('segmenti') as Y.Array<Segmento>
  if (!segmenti.length && (errore || interrotta)) return togli(voce)
  const fine = quando ?? fineDa(voce)
  voce.doc?.transact(() => {
    const visti = new Set<string>()
    const doppie: number[] = []
    segmenti.toArray().forEach((s, i) => (visti.has(chiave(s)) ? doppie.push(i) : visti.add(chiave(s))))
    for (const i of doppie.reverse()) segmenti.delete(i, 1)
    chiudiPausa(voce, fine)   // fermata mentre era in pausa
    voce.set('fine', fine)
    if (interrotta) voce.set('interrotta', true)
  })
}

// ── le pause ────────────────────────────────────────────────────────
//
//  Gli eventi di pausa possono arrivare due volte: la pagina che si
//  ricollega se li fa rimandare tutti. Per questo si segnano solo se
//  non ci sono già.

function pauseDi(voce: Y.Map<unknown>) {
  let pause = voce.get('pause') as Y.Array<Pausa> | undefined
  if (!pause) {
    pause = new Y.Array<Pausa>()
    voce.set('pause', pause)
  }
  return pause
}

export function segnaPausa(voce: Y.Map<unknown>, quando: number) {
  const da = secondi(voce, quando)
  const pause = pauseDi(voce)
  if (pause.toArray().some((p) => p.a === null || Math.abs(p.da - da) < 1)) return
  pause.push([{ da, a: null }])
}

export function chiudiPausa(voce: Y.Map<unknown>, quando: number) {
  const a = secondi(voce, quando)
  const pause = voce.get('pause') as Y.Array<Pausa> | undefined
  const i = pause?.toArray().findIndex((p) => p.a === null && p.da <= a) ?? -1
  if (!pause || i < 0) return
  const { da } = pause.get(i)
  voce.doc?.transact(() => {
    pause.delete(i, 1)
    pause.insert(i, [{ da, a }])
  })
}

/** Quanto è durata la pausa finita, e da quando dura quella in corso:
 *  il cronometro le toglie tutte e due. */
export function contaPause(voce: Y.Map<unknown>) {
  const pause = (voce.get('pause') as Y.Array<Pausa> | undefined)?.toArray() ?? []
  const aperta = pause.find((p) => p.a === null)
  return {
    pausaTotale: Math.round(pause.reduce((s, p) => s + (p.a === null ? 0 : p.a - p.da), 0) * 1000),
    pausaDa: aperta ? avviatoDi(voce) + aperta.da * 1000 : null,
  }
}
