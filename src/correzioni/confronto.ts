import { normalizza } from '../lib/testo'

/*  Il confronto fra due pezzi di testo, senza modelli: tutto ciò che si
 *  può decidere con una regola si decide qui, prima e dopo le chiamate. */

/** Parole, numeri e tutto quello che sta in mezzo, in pezzi separati. */
export const pezzi = (s: string) => s.match(/\p{L}+|\p{N}+|[^\p{L}\p{N}]+/gu) ?? []

/** Solo parole e numeri, senza accenti né maiuscole. */
const parole = (s: string) => pezzi(normalizza(s)).filter((p) => /[\p{L}\p{N}]/u.test(p))

/** Il cambiamento minimo: da «14 luglio 1798» a «14 luglio 1789» cambia
 *  solo «1798». Si confronta a pezzi interi e non a lettere, così non
 *  si spezza mai una parola a metà. `da` e `a` sono posizioni in `prima`. */
export function nucleo(prima: string, dopo: string) {
  const p = pezzi(prima)
  const d = pezzi(dopo)
  let i = 0
  while (i < p.length && i < d.length && p[i] === d[i]) i++
  let j = 0
  while (j < p.length - i && j < d.length - i && p[p.length - 1 - j] === d[d.length - 1 - j]) j++
  const lunghezza = (xs: string[]) => xs.reduce((n, x) => n + x.length, 0)
  return {
    da: lunghezza(p.slice(0, i)),
    a: prima.length - lunghezza(p.slice(p.length - j)),
    sostituto: d.slice(i, d.length - j).join(''),
  }
}

/*  Ogni parola o numero NUOVO della correzione deve venire dalla bocca
 *  del professore. Se non è nella trascrizione, il modello l'ha preso
 *  da quello che sa lui: magari è giusto, ma non è quello che è stato
 *  detto, e qui si confronta solo con la lezione. E la citazione deve
 *  esserci davvero, non riassunta. */
export function fondata(prima: string, dopo: string, detto: string, trascrizione: string) {
  const sentite = new Set(parole(trascrizione))
  const citate = parole(detto)
  if (!citate.length) return false
  if (citate.filter((p) => sentite.has(p)).length / citate.length < 0.7) return false
  const vecchie = new Set(parole(prima))
  return parole(nucleo(prima, dopo).sostituto).every((p) => vecchie.has(p) || sentite.has(p))
}

// ── nomi che suonano uguali ─────────────────────────────────────────

/** Una trascrizione approssimata del suono, quanto basta per i nomi. */
function suono(s: string) {
  return normalizza(s).replace(/[^a-z]/g, '')
    .replace(/eau/g, 'o').replace(/ou/g, 'u').replace(/ph/g, 'f')
    .replace(/ch|qu|c|k/g, 'k').replace(/gh/g, 'g').replace(/[yj]/g, 'i')
    .replace(/w/g, 'v').replace(/z/g, 's').replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
}

function distanza(a: string, b: string) {
  let riga = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const nuova = [i]
    for (let j = 1; j <= b.length; j++) {
      nuova[j] = Math.min(riga[j] + 1, nuova[j - 1] + 1, riga[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    riga = nuova
  }
  return riga[b.length]
}

/*  Due nomi che suonano uguali sono lo stesso nome scritto in due modi:
 *  il riconoscimento vocale storpia i nomi, soprattutto stranieri
 *  («Russo» per «Rousseau»), e in quel caso ha ragione chi scrive.
 *  I numeri romani sono esclusi: «XVII» e «XVIII» non sono lo stesso re. */
export function stessoSuono(a: string, b: string) {
  const parola = /^\p{L}{4,}$/u
  const romano = /^[IVXLCDM]+$/
  if (!parola.test(a) || !parola.test(b) || romano.test(a) || romano.test(b)) return false
  const x = suono(a)
  const y = suono(b)
  return 1 - distanza(x, y) / Math.max(x.length, y.length, 1) >= 0.6
}

// ── quali righe vale la pena controllare ────────────────────────────

/*  Solo quelle con qualcosa di verificabile: un numero, un nome, o un
 *  buco lasciato per dopo. Una riga di soli concetti («il terzo stato
 *  si ribella») non si controlla nemmeno: è la regola che tiene bassi
 *  i costi, a 32 ore di lezione a settimana. */
export function meritaControllo(testo: string) {
  const t = testo.trim()
  if (t.length < 3) return false
  if (/\d/.test(t)) return true                                            // date e numeri
  if (/\.\.|…|\?|_{2,}|\bxx+\b/i.test(t)) return true                      // un buco
  if (t.split(/\s+/).slice(1).some((p) => /^[«"(]?\p{Lu}/u.test(p))) return true   // un nome in mezzo
  return /^\p{Lu}[\p{L}'’-]*\s*[:→=–-]/u.test(t)                           // «Kant: …», «Rousseau → …»
}
