/*  La scheda della correzione aperta: il clic sul pallino a margine la
 *  apre, SchedaCorrezione la mostra. Uno store e non React, come per le
 *  formule: ad aprirla è una decorazione dell'editor, non un componente. */

export type SchedaAperta = { blocco: string; destra: number; sotto: number; sopra: number }

let aperta: SchedaAperta | null = null
const ascoltatori = new Set<() => void>()

export const leggiScheda = () => aperta
export function iscrivitiScheda(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function apriScheda(blocco: string, dove: DOMRect) {
  aperta = { blocco, destra: dove.right, sotto: dove.bottom, sopra: dove.top }
  ascoltatori.forEach((f) => f())
}

export function chiudiScheda() {
  if (!aperta) return
  aperta = null
  ascoltatori.forEach((f) => f())
}
