import type { Editor } from '@tiptap/core'
import { trattiDi } from './merge'
import type { Registrazione } from '../registrazione/tipi'
import { esponi } from '../lib/dev'

/*  Dove hai smesso di scrivere.
 *
 *  Non serve a riempire — quello lo fa «Rifai la pagina», che rimette
 *  in ordine tutto in una volta — ma a dire alla riscrittura dove
 *  stare più attenta: i tratti in cui il professore parlava e tu non
 *  stavi dietro sono quelli in cui gli appunti hanno più bisogno.
 *
 *  ── Trovare un buco senza chiederlo al modello ──────────────────
 *
 *  Ogni pezzo di trascrizione è già agganciato al blocco su cui stava
 *  il cursore mentre il professore parlava. Quindi per ogni blocco si
 *  sa quanti secondi si è parlato e quanto hai scritto nel frattempo.
 *
 *  Un buco non è «poco testo» in assoluto: ci sono lezioni in cui si
 *  scrive poco perché c'è poco da scrivere. È «molto meno di quanto
 *  scrivi di solito». Si prende quindi la TUA mediana di caratteri al
 *  minuto su quella lezione e si segnano i tratti che le stanno molto
 *  sotto: la soglia se la calcola la lezione, non l'ho decisa io. */

const MINIMO = 90          // secondi: sotto, non è un buco, è una pausa
const QUANTO_SOTTO = 0.5   // frazione del tuo ritmo abituale
const MASSIMO = 12         // buchi per lezione: oltre, non è un buco, è l'ora intera
const RITMO_FERMO = 40     // caratteri al minuto, per quando non c'è una mediana

export type Buco = {
  /** il blocco su cui stava il cursore; null = non stavi scrivendo */
  blocco: string | null
  inizio: number
  fine: number
  /** quanto ha detto il professore mentre tu non scrivevi */
  testo: string
  /** caratteri che hai scritto in quel blocco */
  scritto: number
  /** caratteri al minuto, in quel tratto */
  ritmo: number
}

const mediana = (n: number[]) => {
  if (!n.length) return null
  const o = [...n].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)]
}

export function trovaBuchi(editor: Editor, reg: Registrazione): Buco[] {
  const tratti = trattiDi(editor, reg)
  if (!tratti.length) return []
  /*  Quanto hai scritto in ogni blocco, letto dal documento e non da
   *  `blocchiDi`, che elenca le voci ma non l'elenco che le contiene.
   *  Le àncore di una lezione segnano il blocco di primo livello: se
   *  hai riempito tre voci, l'àncora è una sola e punta all'elenco,
   *  e contare solo l'ultima voce faceva sembrare un buco un tratto in
   *  cui avevi scritto tutto. */
  const lunghezze = new Map<string, number>()
  editor.state.doc.descendants((n, _pos, padre) => {
    const id = n.attrs.idBlocco as string | undefined
    if (!id) return true
    /*  Una voce d'elenco vale per tutto il suo elenco. Le àncore di una
     *  lezione segnano un blocco solo per volta: se hai riempito tre
     *  voci una dopo l'altra, quel tratto è stato speso sull'elenco
     *  intero, e contare i caratteri di una voce sola faceva sembrare
     *  un buco il tratto in cui avevi scritto di più. Meglio sbagliare
     *  da questa parte: un buco mancato si vede, uno inventato riscrive
     *  cose che hai già. */
    const testo = n.type.name === 'listItem' && padre ? padre.textContent : n.textContent
    lunghezze.set(id, testo.trim().length)
    return true
  })

  /*  Più tratti sullo stesso blocco (sei tornato indietro) contano
   *  come uno: il testo scritto lì è uno solo, e dividerlo fra i
   *  tratti inventerebbe buchi che non ci sono. */
  const per = new Map<string, Buco & { durata: number }>()
  for (const t of tratti) {
    const chiave = t.blocco ?? '\u0000'
    const gia = per.get(chiave)
    const durata = Math.max(0, t.fine - t.inizio)
    if (gia) {
      gia.durata += durata
      gia.fine = Math.max(gia.fine, t.fine)
      gia.inizio = Math.min(gia.inizio, t.inizio)
      gia.testo += ' ' + t.testo
    } else {
      per.set(chiave, {
        blocco: t.blocco, inizio: t.inizio, fine: t.fine, testo: t.testo,
        scritto: t.blocco ? (lunghezze.get(t.blocco) ?? 0) : 0,
        ritmo: 0, durata,
      })
    }
  }

  const gruppi = [...per.values()]
  for (const g of gruppi) g.ritmo = g.durata > 0 ? (g.scritto * 60) / g.durata : 0

  //  il tuo ritmo su QUESTA lezione, ignorando i tratti troppo corti
  //  per dire qualcosa
  const consistenti = gruppi.filter((g) => g.durata >= 30).map((g) => g.ritmo)
  const tuo = consistenti.length >= 3 ? mediana(consistenti) : null

  return gruppi
    .filter((g) => g.durata >= MINIMO && (tuo !== null ? g.ritmo <= tuo * QUANTO_SOTTO : g.ritmo < RITMO_FERMO))
    .sort((a, b) => b.durata - a.durata)
    .slice(0, MASSIMO)
    .sort((a, b) => a.inizio - b.inizio)
    .map(({ durata: _via, ...b }) => b)
}

esponi({ buchi: { trovaBuchi } })
