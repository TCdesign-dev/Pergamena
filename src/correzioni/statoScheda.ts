/*  La scheda della correzione aperta: il clic sul pallino a margine, o
 *  ⌥⌘↓ e ⌥⌘↑, la aprono; SchedaCorrezione la mostra. Uno store e non
 *  React, come per le formule: ad aprirla è una decorazione dell'editor,
 *  non un componente. Dove metterla lo decide la scheda, dal pallino. */

export type SchedaAperta = { id: string }

let aperta: SchedaAperta | null = null
const ascoltatori = new Set<() => void>()

export const leggiScheda = () => aperta
export function iscrivitiScheda(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriScheda(id: string) {
  if (aperta?.id === id) return
  aperta = { id }
  ascoltatori.forEach((f) => f())
}

export function chiudiScheda() {
  if (!aperta) return
  aperta = null
  ascoltatori.forEach((f) => f())
}
