/*  Le funzioni che intervengono mentre scrivi devono poter essere
 *  spente: la sintassi delle immagini, le correzioni in diretta. Si
 *  aggiungono tutte a questo stesso oggetto. */

export type Impostazioni = {
  sintassiImmagini: boolean   // !Basilica di Superga! fa partire la ricerca
  salvaAudio: boolean         // oltre alla trascrizione, tiene l'audio della lezione
  microfono: string | null    // uid del dispositivo; null = quello di sistema
  fonteImmagini: 'web' | 'commons'   // dove cercano le ricerche del pannello
  correzioniInDiretta: boolean       // mentre registri, segna date, numeri e nomi che non tornano
  /** le istruzioni date al modello per integrare gli appunti;
   *  null = quelle di serie (vedi merge/prompt.ts) */
  promptMerge: string | null
  /** le scorciatoie che hai cambiato: id del comando → combinazione */
  scorciatoie: Record<string, string>
}

/*  L'audio è spento di partenza: un'ora di lezione sono circa 17 MB,
 *  e la trascrizione dal vivo basta per il merge. Si accende quando
 *  serve riascoltare il professore, o una seconda passata più
 *  accurata. */
const PREDEFINITE: Impostazioni = {
  sintassiImmagini: true, salvaAudio: false, microfono: null, fonteImmagini: 'web', correzioniInDiretta: true,
  promptMerge: null, scorciatoie: {},
}
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
