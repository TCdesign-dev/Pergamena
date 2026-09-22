import { esponi } from '../lib/dev'

/*  Come stanno andando le correzioni nella lezione in corso: quante
 *  righe controllate, quante corrette, quanto sono costate. Lo mostra
 *  il pannello delle lezioni, e dice anche quando si sono fermate —
 *  in classe non si interrompe nessuno, ma il perché va scritto da
 *  qualche parte. */

export type StatoCorrezioni = {
  registrazione: string | null // la lezione a cui si riferiscono i conti
  controlli: number            // chiamate a Jev
  sospette: number             // righe che Jev ha passato al secondo stadio
  proposte: number             // correzioni comparse sulla pagina
  costo: number                // $ in questa lezione
  errore: string | null        // l'ultimo intoppo; si riprova da soli
  fermo: 'credito' | null      // il tetto di spesa della chiave è raggiunto
}

const VUOTO: StatoCorrezioni = {
  registrazione: null, controlli: 0, sospette: 0, proposte: 0, costo: 0, errore: null, fermo: null,
}

let stato = VUOTO
const ascoltatori = new Set<() => void>()

export const leggiStatoCorrezioni = () => stato
export function iscrivitiStatoCorrezioni(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function cambia(nuovo: StatoCorrezioni) {
  stato = nuovo
  ascoltatori.forEach((f) => f())
}

/** Una lezione nuova riparte da zero, ma il credito finito resta finito. */
function della(registrazione: string | null) {
  return stato.registrazione === registrazione ? stato : { ...VUOTO, registrazione, fermo: stato.fermo }
}

export function contaControllo(registrazione: string | null, esito: { sospette: number; proposte: number; costo: number }) {
  const s = della(registrazione)
  cambia({
    ...s,
    controlli: s.controlli + 1,
    sospette: s.sospette + esito.sospette,
    proposte: s.proposte + esito.proposte,
    costo: s.costo + esito.costo,
    errore: null,
  })
}

export function segnaIntoppo(registrazione: string | null, errore: string, fermo: StatoCorrezioni['fermo'] = null) {
  cambia({ ...della(registrazione), errore, fermo: fermo ?? stato.fermo })
}

/*  Gli ultimi controlli, per chi collauda: cosa è stato mandato, cosa ha
 *  risposto Jev, cosa è comparso, in quanto tempo. Non finisce da
 *  nessuna parte e non si mostra: si legge da `pergamena.correzioni`. */
export type Voce = {
  quando: number; ultimoGiro: boolean; righe: string[]; probabilita: Record<string, number>; proposte: string[]; ms: number
}
const registro: Voce[] = []
export function annota(v: Voce) {
  registro.push(v)
  if (registro.length > 30) registro.shift()
}

esponi({ correzioni: { leggiStatoCorrezioni, registro } })
