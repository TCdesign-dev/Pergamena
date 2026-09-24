import { apriPannello, iscrivitiPannello, leggiPannello } from '../immagini/statoPannello'
import { apriLezioni, iscrivitiLezioni, leggiLezioni } from '../registrazione/statoLezioni'
import { apriCommenti, iscrivitiCommenti, leggiCommenti } from '../commenti/statoPannello'

/*  «Chiedi alla lezione» aperto o chiuso. Sta dove stanno Lezioni,
 *  Commenti e Immagini — colonna di destra da 1200 px, tendina sotto —
 *  e vale la stessa regola: uno alla volta. */

let aperto = false
const ascoltatori = new Set<() => void>()

export const leggiDomande = () => aperto
export function iscrivitiDomande(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriDomande(v = true) {
  if (v) { apriPannello(false); apriLezioni(false); apriCommenti(false) }
  if (aperto === v) return
  aperto = v
  ascoltatori.forEach((f) => f())
}

iscrivitiPannello(() => { if (leggiPannello().aperto) apriDomande(false) })
iscrivitiLezioni(() => { if (leggiLezioni()) apriDomande(false) })
iscrivitiCommenti(() => { if (leggiCommenti()) apriDomande(false) })
