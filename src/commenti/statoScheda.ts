/*  La scheda del commento aperta adesso: o una nuova, sul pezzo che hai
 *  selezionato, o una che c'è già, aperta cliccando il testo segnato.
 *
 *  Uno store e non React, come per le correzioni e le formule: ad
 *  aprirla è il testo (un clic dentro all'editor) o il menu della
 *  selezione, non un componente che sta sopra. */

export type SchedaCommento =
  | { tipo: 'nuovo'; da: number; a: number }
  | { tipo: 'aperto'; id: string }

let aperta: SchedaCommento | null = null
const ascoltatori = new Set<() => void>()

export const leggiSchedaCommento = () => aperta

export function iscrivitiSchedaCommento(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(nuova: SchedaCommento | null) {
  aperta = nuova
  ascoltatori.forEach((f) => f())
}

/** Un commento nuovo sul tratto selezionato. */
export function apriNuovoCommento(da: number, a: number) {
  if (a <= da) return false
  pubblica({ tipo: 'nuovo', da, a })
  return true
}

export function apriCommento(id: string) {
  if (aperta?.tipo === 'aperto' && aperta.id === id) return
  pubblica({ tipo: 'aperto', id })
}

export function chiudiSchedaCommento() {
  if (aperta) pubblica(null)
}
