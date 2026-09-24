/*  Le chiavi che metti tu, da dentro l'app.
 *
 *  Pergamena nasce con le chiavi in un `.env.local`, che è il posto
 *  giusto quando il progetto è tuo e lo fai girare tu. Ma per chi se
 *  lo scarica, aprire un file nascosto in un editor di testo è il
 *  punto in cui si smette: quindi le chiavi si possono anche incollare
 *  nelle Impostazioni.
 *
 *  Dove finiscono: in `localStorage`, su questo computer, e da lì
 *  viaggiano al server LOCALE (lo stesso Mac) a ogni richiesta, che è
 *  l'unico che parla con OpenRouter. Non le manda a nessun altro, non
 *  le sincronizza e non le mette negli appunti.
 *
 *  Se una chiave c'è anche nel `.env.local`, vince quella: il file sta
 *  fuori dal browser, ed è il posto più sicuro dei due. */

export type Chiavi = {
  /** OpenRouter: serve all'integratore, ai quiz e alle correzioni */
  openrouter: string
  /** Serper: Google Immagini al posto di Openverse (facoltativa) */
  serper: string
  /** Supabase: sincronia fra Mac e telefono (facoltativa) */
  supabaseUrl: string
  supabaseAnon: string
}

const VUOTE: Chiavi = { openrouter: '', serper: '', supabaseUrl: '', supabaseAnon: '' }
const DOVE = 'pergamena:chiavi'

let valori: Chiavi = (() => {
  try {
    return { ...VUOTE, ...JSON.parse(localStorage.getItem(DOVE) ?? '{}') }
  } catch {
    return VUOTE
  }
})()

const ascoltatori = new Set<() => void>()

export const leggiChiavi = () => valori

export function iscrivitiChiavi(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

export function impostaChiave<K extends keyof Chiavi>(nome: K, valore: string) {
  valori = { ...valori, [nome]: valore.trim() }
  try { localStorage.setItem(DOVE, JSON.stringify(valori)) } catch { /* finestra privata: pazienza */ }
  ascoltatori.forEach((f) => f())
}

/** Le intestazioni con cui la chiave arriva al server locale. */
export function intestazioniChiavi(): Record<string, string> {
  const fuori: Record<string, string> = {}
  if (valori.openrouter) fuori['x-chiave-openrouter'] = valori.openrouter
  if (valori.serper) fuori['x-chiave-serper'] = valori.serper
  return fuori
}
