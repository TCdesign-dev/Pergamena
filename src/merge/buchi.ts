import type { Editor } from '@tiptap/core'
import { applica, blocchiDi, type Proposta } from './applica'
import { istruzioniDiStile, stileDellaPagina } from './marcatura'
import { trattiDi } from './merge'
import type { Registrazione } from '../registrazione/tipi'
import { chiediJson } from '../lib/modello'
import { esponi } from '../lib/dev'
import { tr } from '../lingua/lingua'

/*  Riempire i buchi.
 *
 *  L'integratore normale è tarato per essere minimo: proposte corte,
 *  al massimo otto, «colma soltanto i buchi, non riassumere». Funziona
 *  quando ti sei perso venti secondi. Quando ti sei perso sei minuti —
 *  hai smesso di scrivere e il professore è andato avanti — otto righe
 *  non bastano, e quel contratto gli vieta di fare di più.
 *
 *  Qui i vincoli sono rovesciati: pochi punti, ma scritti per bene.
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
const QUANTO_SOTTO = 0.35  // frazione del tuo ritmo abituale
const MASSIMO = 5          // buchi per lezione: oltre, non è un buco, è l'ora intera
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
  const lunghezze = new Map(blocchiDi(editor).map((b) => [b.id, b.testo.trim().length]))

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

/* ── riempirli ──────────────────────────────────────────────────── */

export type Misura = 'ossatura' | 'esteso'

const QUANTE = {
  ossatura: 'Solo l\'ossatura: i concetti, le definizioni, i dati. Da 3 a 5 righe.',
  esteso: 'Quanto serve a coprire ciò che è stato detto: da 5 a 12 righe.',
}

const sistema = (misura: Misura, stile: string) => `Uno studente stava seguendo una lezione e in questo tratto ha smesso di
scrivere. Ti do quello che il professore ha detto mentre lui non scriveva.

Scrivi gli appunti che gli mancano, come li avrebbe scritti lui.

- SOLO quello che è stato detto qui. Non aggiungere sapere tuo, non
  spiegare ciò che il professore non ha spiegato.
- Ti dico DOVE finiranno queste righe: sotto quale titolo, e quali righe
  ci sono subito prima e subito dopo. Guardale, perché decidono una cosa.
  Se quello che è stato detto appartiene a quella sezione, continuala e
  lascia il titolo vuoto. Se invece apre un argomento diverso da quello
  del titolo, dagli un titolo tuo, breve: meglio una sezione nuova che
  un pezzo finito sotto un titolo che parla d'altro.
- ${QUANTE[misura]} Una riga per punto.
- Ignora saluti, battute, ripetizioni, organizzazione del corso.
- La trascrizione è automatica: nomi propri e numeri a volte sono
  storpiati. Scrivi quello che ha detto, non quello che senti male.
- Formule in LaTeX fra dollari, solo se le ha dettate; anche i soli
  pedici e apici sono formule: $\\sigma_{0,2}$, mai <sub> o <sup>.
${stile ? `\nCOME SCRIVE LUI, quando scrive:\n${stile}\n` : ''}
Rispondi SOLO con un oggetto JSON:
{"titolo":"<o vuoto>","righe":["...","..."]}`

/*  Dove finiranno le righe: il titolo della sezione, cosa c'è appena
 *  prima e cosa appena dopo. Senza, il riempitore scriveva alla cieca —
 *  vedeva solo la trascrizione del buco — e un argomento nuovo finiva
 *  sotto il titolo di quello vecchio, perché è lì che era rimasto il
 *  cursore quando hai smesso di scrivere. */
function dintorni(blocchi: { id: string; tipo: string; testo: string }[], dopo: string) {
  const i = blocchi.findIndex((b) => b.id === dopo)
  if (i < 0) return 'DOVE FINIRANNO: in fondo alla pagina.'

  let sezione = '(la pagina non ha titoli)'
  for (let k = i; k >= 0; k--) {
    if (blocchi[k].tipo.startsWith('titolo')) { sezione = blocchi[k].testo; break }
  }
  const prima = blocchi.slice(Math.max(0, i - 1), i + 1).map((b) => `  ${b.testo}`).join('\n')
  const poi = blocchi[i + 1]

  return `DOVE FINIRANNO LE TUE RIGHE:\n` +
    `sotto il titolo «${sezione}», subito dopo queste righe:\n${prima}\n` +
    (poi ? `e subito prima di questa:\n  ${poi.testo}` : 'e in fondo alla pagina.')
}

export type EsitoBuchi = { buchi: number; righe: number; costo: number }

export async function riempiBuchi(
  editor: Editor,
  materia: string,
  reg: Registrazione,
  misura: Misura,
  avanza: (fatti: number, totali: number) => void = () => {},
): Promise<EsitoBuchi> {
  const buchi = trovaBuchi(editor, reg)
  if (!buchi.length) throw new Error(tr('in questa lezione non ci sono buchi da riempire'))

  const stile = istruzioniDiStile(stileDellaPagina(editor.state.doc))
  const blocchi = blocchiDi(editor)
  const ultimo = blocchi[blocchi.length - 1]?.id ?? null
  let righe = 0
  let costo = 0

  for (const [i, buco] of buchi.entries()) {
    avanza(i, buchi.length)
    const dopo = buco.blocco ?? ultimo
    if (!dopo) continue

    const { json, costo: speso } = await chiediJson('merge', [
      { role: 'system', content: sistema(misura, stile) },
      {
        role: 'user',
        content: `MATERIA: ${materia || 'non indicata'}\n\n` +
          `${dintorni(blocchi, dopo)}\n\n` +
          `QUI IL PROFESSORE PARLAVA E LUI NON SCRIVEVA:\n«${buco.testo.trim()}»`,
      },
    ], { maxToken: misura === 'esteso' ? 2500 : 1200 })
    costo += speso

    const titolo = typeof json.titolo === 'string' ? json.titolo.trim() : ''
    const testi = (Array.isArray(json.righe) ? json.righe : [])
      .filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)
      .map((r: string) => r.trim())
    if (!testi.length) continue

    //  si inseriscono come proposte normali: stessa revisione, stesso
    //  segno dell'AI, e il titolo davanti lo mette già `applica`
    const proposte: Proposta[] = testi.map((testo, k) => ({
      dopo, tipo: 'integra' as const, testo, perche: '', importanza: 3,
      ...(k === 0 && titolo ? { titolo } : {}),
    }))
    righe += applica(editor, proposte)
  }

  avanza(buchi.length, buchi.length)
  return { buchi: buchi.length, righe, costo }
}

esponi({ buchi: { trovaBuchi, riempiBuchi } })
