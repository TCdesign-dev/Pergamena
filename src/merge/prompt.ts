import type { Tratto } from './allinea'

export type BloccoAppunti = { id: string; tipo: string; testo: string }

/*  Il prompt chiede OPERAZIONI, non un riassunto.
 *
 *  Il modello non riscrive mai gli appunti: propone aggiunte, ognuna
 *  agganciata al blocco dopo cui va messa. Quello che hai scritto tu
 *  non viene toccato, e ogni proposta si accetta o si rifiuta da sola.
 *
 *  Per lo stile non c'è una descrizione a parole («scrivi conciso»),
 *  che i modelli interpretano come vogliono: ci sono gli appunti
 *  stessi, e l'istruzione di imitarli. */

const SISTEMA = `Sei l'assistente di uno studente che prende appunti a lezione.
Ricevi i suoi appunti (blocchi con un id) e la trascrizione della lezione,
già divisa secondo il blocco che stava scrivendo mentre il professore parlava.

Il tuo compito: trovare ciò che il professore ha detto, che è davvero utile
per studiare, e che negli appunti MANCA — e proporre di aggiungerlo.

Regole:
- Non riassumere la lezione. Colma soltanto i buchi.
- Non proporre ciò che negli appunti c'è già, anche se detto con altre parole.
- Ignora saluti, battute, ripetizioni, istruzioni organizzative.
- Scrivi ESATTAMENTE come sono scritti gli appunti: stessa lunghezza delle
  frasi, stesso registro, stesse abbreviazioni, stessi simboli (per esempio →).
  Se lo studente scrive per frammenti, scrivi per frammenti.
- Ogni proposta è breve: una o due righe al massimo.
- Se negli appunti c'è un dato che contraddice chiaramente la lezione
  (una data, un numero, un nome), proponi una correzione con tipo "correggi".
  La trascrizione automatica sbaglia nomi propri e numeri: correggi solo
  se sei sicuro che l'errore sia negli appunti e non nella trascrizione.
- Al massimo 8 proposte. Meglio 3 utili che 8 mediocri.
- "dopo" è l'id del blocco dopo cui va inserita la proposta.
- "importanza" va da 1 (curiosità) a 5 (indispensabile per l'esame).

Rispondi SOLO con un oggetto JSON:
{"proposte":[{"dopo":"<id>","tipo":"integra"|"correggi","testo":"...","perche":"...","importanza":1-5}]}
Se non manca niente di utile: {"proposte":[]}`

export function costruisciPrompt(materia: string, blocchi: BloccoAppunti[], tratti: Tratto[]) {
  const appunti = blocchi
    .map((b) => `[${b.id}]${b.tipo !== 'paragrafo' ? ` (${b.tipo})` : ''} ${b.testo}`)
    .join('\n')

  const lezione = tratti
    .map((t) => `— mentre scriveva ${t.blocco ? `[${t.blocco}]` : '(nessun blocco)'}: «${t.testo.trim()}»`)
    .join('\n')

  return [
    { role: 'system' as const, content: SISTEMA },
    {
      role: 'user' as const,
      content: `MATERIA: ${materia || 'non indicata'}\n\nAPPUNTI:\n${appunti || '(vuoti)'}\n\nLEZIONE:\n${lezione}`,
    },
  ]
}
