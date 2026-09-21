import { cercaSuCommons, type Trovata } from './commons'

/*  Il pannello è una pila di ricerche, dalla più recente.
 *  Ci finiscono sia quelle scritte a mano sia quelle nate dalla
 *  sintassi !…! mentre prendi appunti: sono la stessa cosa, e tenerle
 *  nello stesso posto evita due liste che dicono quasi il medesimo. */

export type Ricerca = {
  id: string
  query: string
  origine: 'manuale' | 'sintassi'
  stato: 'in-corso' | 'pronta' | 'errore'
  risultati: Trovata[]
  errore?: string
}

export type Scheda = 'consigliate' | 'cercate'
type Stato = { aperto: boolean; scheda: Scheda; ricerche: Ricerca[] }

let stato: Stato = { aperto: false, scheda: 'cercate', ricerche: [] }
const ascoltatori = new Set<() => void>()

export const leggiPannello = () => stato

export function iscrivitiPannello(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(nuovo: Stato) {
  stato = nuovo
  ascoltatori.forEach((f) => f())
}

export function apriPannello(aperto = true, scheda?: Scheda) {
  if (stato.aperto !== aperto || (scheda && scheda !== stato.scheda)) {
    pubblica({ ...stato, aperto, scheda: scheda ?? stato.scheda })
  }
}

export function scegliScheda(scheda: Scheda) {
  if (stato.scheda !== scheda) pubblica({ ...stato, scheda })
}

export function scartaRicerca(id: string) {
  pubblica({ ...stato, ricerche: stato.ricerche.filter((r) => r.id !== id) })
}

export async function avviaRicerca(query: string, origine: Ricerca['origine'] = 'manuale') {
  const q = query.trim()
  if (q.length < 2) return

  const id = crypto.randomUUID()
  const nuova: Ricerca = { id, query: q, origine, stato: 'in-corso', risultati: [] }

  // una ricerca uguale già in cima non si duplica
  const senzaDoppioni = stato.ricerche.filter((r) => r.query.toLowerCase() !== q.toLowerCase())
  // una ricerca porta sempre sulla scheda delle ricerche
  pubblica({ aperto: true, scheda: 'cercate', ricerche: [nuova, ...senzaDoppioni].slice(0, 8) })

  const aggiorna = (patch: Partial<Ricerca>) =>
    pubblica({
      ...stato,
      ricerche: stato.ricerche.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })

  try {
    aggiorna({ risultati: await cercaSuCommons(q), stato: 'pronta' })
  } catch (e) {
    aggiorna({ stato: 'errore', errore: e instanceof Error ? e.message : 'ricerca fallita' })
  }
}
