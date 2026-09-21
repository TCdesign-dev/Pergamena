/*  Lo stato della registrazione in corso, per l'interfaccia. Il
 *  contenuto vero (segmenti e àncore) finisce nel documento Yjs;
 *  qui c'è solo ciò che serve a disegnare: da quanto si registra,
 *  quanto è forte il segnale, l'ultima frase ancora provvisoria. */

export type StatoRegistrazione = {
  attiva: boolean
  avvio: 'fermo' | 'parto' | 'ascolto' | 'chiudo'
  id: string | null
  documentoId: string | null
  inizio: number | null      // ms, quando il riconoscitore è pronto
  livello: number            // dB, -160 … 0
  provvisorio: string        // la frase che si sta ancora formando
  errore: string | null
}

const FERMO: StatoRegistrazione = {
  attiva: false, avvio: 'fermo', id: null, documentoId: null,
  inizio: null, livello: -160, provvisorio: '', errore: null,
}

let stato = FERMO
const ascoltatori = new Set<() => void>()

export const leggiRegistrazione = () => stato
export function iscrivitiRegistrazione(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
export function aggiorna(p: Partial<StatoRegistrazione>) {
  stato = { ...stato, ...p }
  ascoltatori.forEach((f) => f())
}
export function azzera(errore: string | null = null) {
  stato = { ...FERMO, errore }
  ascoltatori.forEach((f) => f())
}
