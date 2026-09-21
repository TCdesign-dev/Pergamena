import type { Ambito } from './quiz'

/*  Il quiz aperto. Lo aprono posti diversi — il ripasso, il menu della
 *  selezione, la palette — e la finestra sta una volta sola in App. */

let ambito: Ambito | null = null
const ascoltatori = new Set<() => void>()

export const leggiQuiz = () => ambito
export function iscrivitiQuiz(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
export function apriQuiz(a: Ambito | null) {
  ambito = a
  ascoltatori.forEach((fn) => fn())
}
