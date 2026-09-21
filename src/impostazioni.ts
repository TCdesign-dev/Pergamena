/*  Le funzioni che intervengono mentre scrivi devono poter essere
 *  spente. Qui stanno quelle della fase 2; le altre si aggiungono
 *  a questo stesso oggetto. */

export type Impostazioni = {
  sintassiImmagini: boolean   // !Basilica di Superga! fa partire la ricerca
  salvaAudio: boolean         // oltre alla trascrizione, tiene l'audio della lezione
}

/*  L'audio è spento di partenza: il disco è pieno al 97%, e la
 *  trascrizione dal vivo basta per il merge. Si accende quando serve
 *  riascoltare il professore, o una seconda passata più accurata. */
const PREDEFINITE: Impostazioni = { sintassiImmagini: true, salvaAudio: false }
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
