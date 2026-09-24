import { esponi } from './dev'
import { intestazioniChiavi } from '../chiavi'

/*  Le domande a Jev (vedi server/decisioni.ts).
 *
 *  Uno STATO — qualunque oggetto, anche testo libero — e delle domande
 *  con un nome ciascuna. Jev le valuta tutte insieme, ognuna per conto
 *  suo, e risponde con numeri: aggiungere una domanda quasi non cambia
 *  il tempo di risposta. Non scrive mai testo, quindi non può inventare. */

export type Domanda =
  /** sì o no: risponde con la probabilità del sì */
  | { type: 'noul'; instructions: string; criteria: { true: string; false: string } }
  /** una fra le opzioni date */
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  /** un voto su livelli in ordine, dal più basso */
  | { type: 'score'; instructions: string; criteria: string[] }

export type Risposta =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number }

/** Il tetto di spesa della chiave è raggiunto: inutile insistere. */
export class CreditoFinito extends Error {}

/*  «Insufficient credits» (402) o «Key limit exceeded»: non passa da
 *  solo. Un «rate limit» invece sì, e non deve fermare niente. */
export const eCreditoFinito = (stato: number, messaggio: string) =>
  stato === 402 || (!/rate.?limit|too many/i.test(messaggio) && /insufficient|credit|key limit|spend/i.test(messaggio))

export async function decidi(stato: unknown, domande: Record<string, Domanda>) {
  const r = await fetch('/api/decisioni', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...intestazioniChiavi() },
    body: JSON.stringify({ state: stato, questions: domande }),
  })
  const dati = await r.json().catch(() => ({}))
  if (!r.ok || dati.error) {
    const messaggio = String(dati.error?.message ?? dati.errore ?? `Jev non risponde (${r.status})`)
    if (eCreditoFinito(r.status, messaggio)) throw new CreditoFinito(messaggio)
    throw new Error(messaggio)
  }
  return {
    risposte: (dati.answers ?? {}) as Record<string, Risposta>,
    costo: Number(dati.usage?.cost) || 0,
  }
}

esponi({ decidi })
