/*  La finestra delle Impostazioni: la aprono ⌘, la rotaia, la barra
 *  laterale, il piede del pannello Lezioni e «Cambia microfono». Uno
 *  store e non uno stato di App, perché chi la apre sta dappertutto. */

export type Sezione = 'aspetto' | 'registrazione' | 'immagini' | 'tastiera' | 'archivio'

type Stato = { aperta: boolean; sezione: Sezione; microfono: boolean }

let stato: Stato = { aperta: false, sezione: 'aspetto', microfono: false }
const ascoltatori = new Set<() => void>()

export const leggiImpostazioniAperte = () => stato
export function iscrivitiImpostazioniAperte(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

/** `microfono`: si arriva dritti alla scelta del microfono. */
export function apriImpostazioni(sezione: Sezione = stato.sezione, microfono = false) {
  stato = { aperta: true, sezione, microfono }
  ascoltatori.forEach((f) => f())
}

export function scegliSezione(sezione: Sezione) {
  stato = { ...stato, sezione, microfono: false }
  ascoltatori.forEach((f) => f())
}

export function chiudiImpostazioni() {
  if (!stato.aperta) return
  stato = { ...stato, aperta: false, microfono: false }
  ascoltatori.forEach((f) => f())
}
