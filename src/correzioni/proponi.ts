import { chiediJson } from '../lib/modello'
import { normalizza } from '../lib/testo'
import { fondata, nucleo, stessoSuono } from './confronto'
import type { TipoCorrezione } from './tipi'
import type { Riga } from './triage'

/*  Il secondo stadio: sulle sole righe sospette, il modello veloce dice
 *  COSA cambiare, con le parole del professore che lo dimostrano. Poi
 *  le regole di confronto.ts scartano quello che non torna: il pezzo da
 *  cambiare deve esserci davvero, ogni parola nuova deve essere stata
 *  detta, due nomi che suonano uguali non sono un errore. */

const SISTEMA = `Aiuti uno studente che prende appunti a lezione. Ricevi la trascrizione automatica di quello che il professore ha detto negli ultimi 90 secondi e alcune righe degli appunti.

Segnala SOLO questi due casi:
- "sbagliato": una data, un numero, una quantità o un nome proprio che negli appunti è DIVERSO da quello che il professore ha detto sullo stesso fatto;
- "mancante": una data, un numero o un nome lasciato a metà negli appunti (puntini, punto di domanda, cifre incomplete) che il professore ha detto per intero.

NON segnalare mai:
- stile, abbreviazioni, simboli, ortografia, parafrasi, riassunti;
- cose che il professore non ha detto in questa trascrizione (anche se sai che sono sbagliate: conta solo cosa ha detto lui);
- nomi che nella trascrizione sono scritti in modo diverso ma suonano simili: il riconoscimento vocale storpia i nomi, specie stranieri (es. "Russo" per "Rousseau"). In quel caso ha ragione lo studente.

Per ogni caso:
- "blocco": l'etichetta della riga (B1, B2…);
- "prima": il pezzo ESATTO degli appunti da cambiare, copiato carattere per carattere, il più corto possibile ma univoco nella riga (es. "1798", non tutta la riga);
- "dopo": come deve diventare quel pezzo, nello stesso stile dello studente (cifre se usa cifre, abbreviazioni se ne usa);
- "detto": le parole esatte della trascrizione che lo dimostrano, al massimo 12 parole, copiate dalla trascrizione;
- "tipo": "data", "numero", "nome" oppure "mancante".

Rispondi solo con JSON: {"correzioni":[...]}. Se non c'è niente da segnalare: {"correzioni":[]}.`

const TIPI: TipoCorrezione[] = ['data', 'numero', 'nome', 'mancante']

export type Proposta = { etichetta: string; prima: string; dopo: string; detto: string; tipo: TipoCorrezione }

/** Il pezzo com'è davvero nella riga: copiandolo, il modello a volte
 *  cambia una maiuscola o un accento. */
function ritrova(testo: string, pezzo: string): string | null {
  if (!pezzo.trim()) return null
  if (testo.includes(pezzo)) return pezzo
  const i = normalizza(testo).indexOf(normalizza(pezzo))
  return i >= 0 ? testo.slice(i, i + pezzo.length) : null
}

export async function proponi(trascrizione: string, righe: Riga[], materia: string) {
  const utente = [
    materia && `MATERIA: ${materia}`,
    `TRASCRIZIONE (ultimi 90 secondi):\n${trascrizione}`,
    `APPUNTI:\n${righe.map((r) => `${r.etichetta}: ${r.testo}`).join('\n')}`,
  ].filter(Boolean).join('\n\n')

  const { json, costo } = await chiediJson('veloce', [
    { role: 'system', content: SISTEMA },
    { role: 'user', content: utente },
  ], { maxToken: 800 })

  const testi = new Map(righe.map((r) => [r.etichetta, r.testo]))
  const proposte: Proposta[] = []
  for (const x of Array.isArray(json.correzioni) ? json.correzioni : []) {
    const etichetta = String(x?.blocco ?? '')
    const testo = testi.get(etichetta)
    const prima = testo ? ritrova(testo, String(x?.prima ?? '')) : null
    const dopo = String(x?.dopo ?? '').trim()
    const detto = String(x?.detto ?? '').trim()
    if (!prima || !dopo || dopo === prima) continue
    const { da, a, sostituto } = nucleo(prima, dopo)
    if (stessoSuono(prima.slice(da, a), sostituto.trim())) continue
    if (!fondata(prima, dopo, detto, trascrizione)) continue
    proposte.push({ etichetta, prima, dopo, detto, tipo: TIPI.includes(x?.tipo) ? x.tipo : 'numero' })
  }
  return { proposte, costo }
}
