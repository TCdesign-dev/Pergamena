import { decidi, type Domanda } from '../lib/decisioni'

/*  Il primo filtro. Jev guarda tutte le righe insieme e dice, per
 *  ognuna, quanto è probabile che una data, un numero o un nome non
 *  torni con quello che il professore ha appena detto. 300-600 ms e
 *  qualche millesimo di centesimo: solo le righe sospette passano al
 *  modello che scrive la correzione, che costa dieci volte tanto.
 *
 *  Provato su una lezione sulla Rivoluzione francese: gli errori veri
 *  escono fra 0,85 e 0,98, le righe giuste fra 0,1 e 0,25 — anche
 *  quando la trascrizione dice «Russo» e gli appunti «Rousseau». */

export const SOGLIA = 0.5

export type Riga = { etichetta: string; testo: string }

const domanda = (b: string): Domanda => ({
  type: 'noul',
  instructions: `Nel blocco ${b} degli appunti c'è una data, un numero o un nome che il professore ha detto in modo diverso, oppure lasciato a metà mentre il professore l'ha detto per intero?`,
  criteria: {
    true: `Il blocco ${b} ha una data, un numero o un nome sbagliato o incompleto rispetto a quello che ha detto il professore`,
    false: `Il blocco ${b} è coerente con quello che ha detto il professore, oppure parla di cose che il professore non ha detto; abbreviazioni, parafrasi e nomi scritti in modo diverso dalla trascrizione automatica vanno bene`,
  },
})

export async function sospette(trascrizione: string, righe: Riga[], materia: string) {
  const stato = {
    ...(materia ? { materia } : {}),
    professore: trascrizione,
    appunti: Object.fromEntries(righe.map((r) => [r.etichetta, r.testo])),
  }
  const { risposte, costo } = await decidi(stato, Object.fromEntries(righe.map((r) => [r.etichetta, domanda(r.etichetta)])))
  const probabilita: Record<string, number> = {}
  for (const r of righe) {
    const x = risposte[r.etichetta]
    probabilita[r.etichetta] = x?.type === 'noul' ? x.noul : 0
  }
  return { sospette: righe.filter((r) => probabilita[r.etichetta] >= SOGLIA), probabilita, costo }
}
