import { apriPannello, iscrivitiPannello, leggiPannello } from '../immagini/statoPannello'

/*  Il pannello Lezioni aperto o chiuso. Da 1200 px in su sta nella
 *  colonna di destra, la stessa delle Immagini: si apre uno alla volta,
 *  e aprire l'uno chiude l'altro. Sotto i 1200 sono due tendine, e vale
 *  la stessa regola. */

let aperto = false
const ascoltatori = new Set<() => void>()

export const leggiLezioni = () => aperto
export function iscrivitiLezioni(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriLezioni(v = true) {
  if (v) apriPannello(false)
  if (aperto === v) return
  aperto = v
  ascoltatori.forEach((f) => f())
}

// si aprono le Immagini: le Lezioni lasciano il posto
iscrivitiPannello(() => { if (leggiPannello().aperto) apriLezioni(false) })
