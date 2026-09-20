import type { Editor, Range } from '@tiptap/core'
import type { VoceSlash } from './vociSlash'

/*  Il plugin di ProseMirror e il componente React devono guardare lo
 *  stesso stato: il plugin intercetta i tasti (le frecce e Invio non
 *  devono mai uscire dall'editor), React disegna. Un piccolo store
 *  condiviso è più semplice e meno fragile di un intreccio di ref. */

export type StatoSlash = {
  aperto: boolean
  voci: VoceSlash[]
  indice: number
  rect: DOMRect | null
  editor: Editor | null
  range: Range | null
  esegui: ((voce: VoceSlash) => void) | null
}

const VUOTO: StatoSlash = {
  aperto: false, voci: [], indice: 0, rect: null, editor: null, range: null, esegui: null,
}

let stato: StatoSlash = VUOTO
const ascoltatori = new Set<() => void>()

export const leggiSlash = () => stato
export function iscrivitiSlash(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(nuovo: StatoSlash) {
  stato = nuovo
  ascoltatori.forEach((f) => f())
}

export function apriSlash(p: Partial<StatoSlash>) {
  pubblica({ ...VUOTO, ...p, aperto: true, indice: 0 })
}

export function aggiornaSlash(p: Partial<StatoSlash>) {
  if (!stato.aperto) return
  pubblica({ ...stato, ...p })
}

export function chiudiSlash() {
  if (stato.aperto) pubblica(VUOTO)
}

export function muoviSlash(passo: number) {
  const n = stato.voci.length
  if (!n) return false
  pubblica({ ...stato, indice: (stato.indice + passo + n) % n })
  return true
}

export function scegliSlash(indice = stato.indice) {
  const voce = stato.voci[indice]
  if (!voce || !stato.esegui) return false
  stato.esegui(voce)
  return true
}
