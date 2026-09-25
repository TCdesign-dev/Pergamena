import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { blocchiDi } from '../merge/applica'
import { leggiRegistrazioni } from '../registrazione/registrazione'
import { chiediTesto, type Messaggio } from '../lib/modello'
import { aggiungiDomanda, domandeDi, type Domanda } from './deposito'
import { esponi } from '../lib/dev'
import { comeRispondere, locale, tr } from '../lingua/lingua'

/*  Chiedere alla lezione.
 *
 *  Il modello riceve due cose: i tuoi appunti e la trascrizione di
 *  quello che è stato detto. Non cerca su internet e non sa niente
 *  d'altro — se la risposta non c'è in quelle due cose, deve dirlo,
 *  perché una risposta inventata su una materia che stai imparando è
 *  peggio di nessuna risposta.
 *
 *  Le domande di prima viaggiano con la nuova: «e quindi?» dopo una
 *  risposta deve voler dire qualcosa. */

const SISTEMA = `Rispondi alle domande di uno studente sulla sua lezione.

Hai due fonti, e solo quelle: i suoi APPUNTI e la TRASCRIZIONE di ciò che
ha detto il professore. La trascrizione è automatica: i nomi propri e i
numeri a volte sono storpiati, e si capisce dal contesto.

Regole:
- Rispondi solo con quello che c'è nelle due fonti. Se non c'è, dillo in
  una riga: «di questo la lezione non parla» — e, se puoi, di' qual è la
  cosa più vicina che è stata detta.
- Distingui le due fonti quando conta: «l'ha detto il professore», «nei
  tuoi appunti c'è già».
- Cita il professore fra virgolette quando la citazione risponde meglio
  di una parafrasi, e indica il minuto se lo sai: «(0:42)».
- Breve: quattro o cinque righe. Elenchi solo se la domanda chiede una
  lista, uno per riga, aperti da «- ».
- Per dare risalto hai **grassetto** e $formule$, e nient'altro:
  niente titoli, niente tabelle, niente virgolette di codice.
- Niente premesse («certo!», «ottima domanda»):
  si comincia dalla risposta.
- Non correggere gli appunti e non proporre di riscriverli: per quello
  c'è l'integratore. Qui si risponde e basta.`

const tempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const giorno = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })

/** Gli appunti e le lezioni della pagina, come li legge il modello. */
export function contesto(editor: Editor, doc: Y.Doc) {
  const appunti = blocchiDi(editor)
    .map((b) => `${b.tipo !== 'paragrafo' ? `(${b.tipo}) ` : ''}${b.testo}`)
    .join('\n')

  const lezioni = leggiRegistrazioni(doc).filter((r) => r.segmenti.length)
  const trascrizione = lezioni
    .map((r) => {
      const frasi = r.segmenti.map((s) => `[${tempo(s.inizio)}] ${s.testo}`).join('\n')
      return `── lezione del ${giorno(r.inizio)} ──\n${frasi}`
    })
    .join('\n\n')

  return { appunti, trascrizione, lezioni: lezioni.length }
}

/** Le ultime domande e risposte, per capire i «e quindi?». */
function primaDiQuesta(doc: Y.Doc, quante = 3): Messaggio[] {
  return domandeDi(doc)
    .slice(-quante)
    .flatMap((d): Messaggio[] => [
      { role: 'user', content: d.domanda },
      { role: 'assistant', content: d.risposta },
    ])
}

export async function chiediAllaLezione(
  editor: Editor,
  doc: Y.Doc,
  materia: string,
  domanda: string,
): Promise<Domanda> {
  const testo = domanda.trim()
  if (!testo) throw new Error(tr('scrivi una domanda'))

  const { appunti, trascrizione, lezioni } = contesto(editor, doc)
  if (!trascrizione && !appunti) throw new Error(tr('questa pagina è vuota: non c’è niente da chiedere'))

  const messaggi: Messaggio[] = [
    { role: 'system', content: `${SISTEMA}\n\n${comeRispondere()}` },
    {
      role: 'user',
      content: `MATERIA: ${materia || 'non indicata'}\n\n` +
        `APPUNTI:\n${appunti || '(vuoti)'}\n\n` +
        `TRASCRIZIONE:\n${trascrizione || '(nessuna lezione registrata in questa pagina)'}`,
    },
    { role: 'assistant', content: 'Ho letto gli appunti e la lezione. Chiedimi pure.' },
    ...primaDiQuesta(doc),
    { role: 'user', content: testo },
  ]

  const { testo: risposta, costo } = await chiediTesto('domanda', messaggi, { maxToken: 1200 })
  return aggiungiDomanda(doc, { domanda: testo, risposta, lezioni, costo })
}

esponi({ domande: { chiediAllaLezione, contesto } })
