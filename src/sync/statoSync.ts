export type StatoSync = 'spento' | 'collego' | 'allineato' | 'invio' | 'offline'

let stato: StatoSync = 'spento'
let ultimoErrore = ''
const ascoltatori = new Set<() => void>()

export const leggiSync = () => stato
export const erroreSync = () => ultimoErrore

export function iscrivitiSync(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function segnala(nuovo: StatoSync, errore = '') {
  if (stato === nuovo && ultimoErrore === errore) return
  stato = nuovo
  ultimoErrore = errore
  ascoltatori.forEach((f) => f())
}
