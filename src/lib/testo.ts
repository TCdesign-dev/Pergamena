const ACCENTATE = 'àáâãäåèéêëìíîïòóôõöùúûüçñýÿ'
const SEMPLICI  = 'aaaaaaeeeeiiiiooooouuuucnyy'

/*  Toglie accenti e maiuscole SENZA cambiare la lunghezza della
 *  stringa. La via ovvia — normalize('NFD') più rimozione dei segni —
 *  accorcia il testo, e le posizioni trovate nella versione
 *  normalizzata non corrisponderebbero più a quelle nel testo vero:
 *  le anteprime della ricerca uscirebbero sfasate di qualche carattere. */
export function normalizza(s: string) {
  let out = ''
  for (const ch of s.toLowerCase()) {
    const i = ACCENTATE.indexOf(ch)
    out += i >= 0 ? SEMPLICI[i] : ch
  }
  return out
}
