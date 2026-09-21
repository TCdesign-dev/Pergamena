/*  La formula che si sta scrivendo: il clic su una formula, o «/formula»,
 *  la apre; la finestrella EditorFormula la mostra accanto al nodo. Uno
 *  store e non React, perché ad aprirla sono le estensioni dell'editor. */

export type FormulaAperta = { tipo: 'inline' | 'blocco'; pos: number; latex: string; nuova: boolean }

let aperta: FormulaAperta | null = null
const ascoltatori = new Set<() => void>()

export const leggiFormula = () => aperta
export function iscrivitiFormula(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
export function apriFormula(f: FormulaAperta | null) {
  aperta = f
  ascoltatori.forEach((fn) => fn())
}
