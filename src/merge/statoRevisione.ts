/*  La revisione è una MODALITÀ, e va dichiarata: J, K e X servono
 *  a scrivere, e prenderseli senza chiedere vorrebbe dire rubare
 *  lettere a chi sta prendendo appunti. Si entra dopo un merge, si
 *  esce con Esc o quando le proposte finiscono. */

let attiva = false
const ascoltatori = new Set<() => void>()

export const revisioneAttiva = () => attiva
export function iscrivitiRevisione(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
function pubblica(v: boolean) {
  if (attiva === v) return
  attiva = v
  ascoltatori.forEach((f) => f())
}
export const avviaRevisione = () => pubblica(true)
export const chiudiRevisione = () => pubblica(false)
