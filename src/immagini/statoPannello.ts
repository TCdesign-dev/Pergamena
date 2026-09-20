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

type Stato = { aperto: boolean; ricerche: Ricerca[] }

let stato: Stato = { aperto: false, ricerche: [] }
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

export function apriPannello(aperto = true) {
  if (stato.aperto !== aperto) pubblica({ ...stato, aperto })
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
  pubblica({ aperto: true, ricerche: [nuova, ...senzaDoppioni].slice(0, 8) })

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
