/*  Le funzioni che intervengono mentre scrivi devono poter essere
 *  spente. Qui stanno quelle della fase 2; le altre si aggiungono
 *  a questo stesso oggetto. */

export type Impostazioni = {
  sintassiImmagini: boolean   // !Basilica di Superga! fa partire la ricerca
}

const PREDEFINITE: Impostazioni = { sintassiImmagini: true }
const CHIAVE = 'pergamena:impostazioni'

let valori: Impostazioni = (() => {
  try {
    return { ...PREDEFINITE, ...JSON.parse(localStorage.getItem(CHIAVE) ?? '{}') }
  } catch {
    return PREDEFINITE
  }
})()

const ascoltatori = new Set<() => void>()

export const leggiImpostazioni = () => valori

export function iscrivitiImpostazioni(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function imposta<K extends keyof Impostazioni>(chiave: K, valore: Impostazioni[K]) {
  valori = { ...valori, [chiave]: valore }
  try { localStorage.setItem(CHIAVE, JSON.stringify(valori)) } catch { /* pazienza */ }
  ascoltatori.forEach((f) => f())
}
