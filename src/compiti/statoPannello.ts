import { apriPannello, iscrivitiPannello, leggiPannello } from '../immagini/statoPannello'
import { apriLezioni, iscrivitiLezioni, leggiLezioni } from '../registrazione/statoLezioni'
import { apriCommenti, iscrivitiCommenti, leggiCommenti } from '../commenti/statoPannello'
import { apriDomande, iscrivitiDomande, leggiDomande } from '../domande/statoPannello'

/*  I Compiti aperti o chiusi. Stanno dove stanno Lezioni, Commenti,
 *  Domande e Immagini — colonna di destra da 1200 px, tendina sotto —
 *  e vale la stessa regola: uno alla volta. */

let aperto = false
const ascoltatori = new Set<() => void>()

export const leggiCompiti = () => aperto
export function iscrivitiCompiti(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriCompiti(v = true) {
  if (v) { apriPannello(false); apriLezioni(false); apriCommenti(false); apriDomande(false) }
  if (aperto === v) return
  aperto = v
  ascoltatori.forEach((f) => f())
}

iscrivitiPannello(() => { if (leggiPannello().aperto) apriCompiti(false) })
iscrivitiLezioni(() => { if (leggiLezioni()) apriCompiti(false) })
iscrivitiCommenti(() => { if (leggiCommenti()) apriCompiti(false) })
iscrivitiDomande(() => { if (leggiDomande()) apriCompiti(false) })
