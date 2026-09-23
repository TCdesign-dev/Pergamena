import { apriPannello, iscrivitiPannello, leggiPannello } from '../immagini/statoPannello'
import { apriLezioni, iscrivitiLezioni, leggiLezioni } from '../registrazione/statoLezioni'

/*  Il pannello Commenti aperto o chiuso. Sta dove stanno Lezioni e
 *  Immagini — la colonna di destra da 1200 px, una tendina sotto — e
 *  vale la stessa regola: uno alla volta. */

let aperto = false
const ascoltatori = new Set<() => void>()

export const leggiCommenti = () => aperto
export function iscrivitiCommenti(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriCommenti(v = true) {
  if (v) { apriPannello(false); apriLezioni(false) }
  if (aperto === v) return
  aperto = v
  ascoltatori.forEach((f) => f())
}

// si apre un altro pannello: i commenti lasciano il posto
iscrivitiPannello(() => { if (leggiPannello().aperto) apriCommenti(false) })
iscrivitiLezioni(() => { if (leggiLezioni()) apriCommenti(false) })
