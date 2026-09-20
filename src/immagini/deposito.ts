/*  Le immagini si COPIANO qui dentro, non si collegano.
 *
 *  Un link a Commons prima o poi marcisce, e senza connessione non
 *  vedresti più niente durante un ripasso. I byte vivono in
 *  IndexedDB insieme alla loro attribuzione, che per le immagini di
 *  Commons è un obbligo della licenza, non un vezzo. */

const DB = 'pergamena:immagini'
const DEPOSITO = 'file'

export type MetaImmagine = {
  id: string
  tipo: string
  larghezza: number
  altezza: number
  origine: string        // la pagina da cui viene, per risalirci
  attribuzione: string   // autore
  licenza: string
  creato: number
}

type Voce = MetaImmagine & { blob: Blob }

let connessione: Promise<IDBDatabase> | null = null

function apri(): Promise<IDBDatabase> {
  if (connessione) return connessione
  connessione = new Promise((risolvi, rifiuta) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DEPOSITO)) {
        req.result.createObjectStore(DEPOSITO, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => risolvi(req.result)
    req.onerror = () => rifiuta(req.error)
  })
  return connessione
}

function transazione<T>(modo: IDBTransactionMode, fn: (d: IDBObjectStore) => IDBRequest<T>) {
  return apri().then(
    (db) =>
      new Promise<T>((risolvi, rifiuta) => {
        const req = fn(db.transaction(DEPOSITO, modo).objectStore(DEPOSITO))
        req.onsuccess = () => risolvi(req.result)
        req.onerror = () => rifiuta(req.error)
      }),
  )
}

export async function salva(blob: Blob, meta: Omit<MetaImmagine, 'id' | 'creato' | 'tipo'>) {
  const id = crypto.randomUUID()
  const voce: Voce = { ...meta, id, tipo: blob.type, creato: Date.now(), blob }
  await transazione('readwrite', (d) => d.put(voce))
  return id
}

export async function leggi(id: string) {
  return transazione<Voce | undefined>('readonly', (d) => d.get(id))
}

export async function elimina(id: string) {
  urlCache.get(id) && URL.revokeObjectURL(urlCache.get(id)!)
  urlCache.delete(id)
  await transazione('readwrite', (d) => d.delete(id))
}

export async function tutte() {
  return transazione<Voce[]>('readonly', (d) => d.getAll())
}

/*  Un object URL per immagine, creato una volta sola: rigenerarlo a
 *  ogni ridisegno farebbe lampeggiare l'immagine e perderebbe la
 *  cache del browser. */
const urlCache = new Map<string, string>()

export async function urlDi(id: string): Promise<string | null> {
  const gia = urlCache.get(id)
  if (gia) return gia
  const voce = await leggi(id)
  if (!voce) return null
  const url = URL.createObjectURL(voce.blob)
  urlCache.set(id, url)
  return url
}

/** Quanto occupano le immagini: serve al gestore dell'archivio (fase 4). */
export async function spazioOccupato() {
  const voci = await tutte()
  return voci.reduce((somma, v) => somma + v.blob.size, 0)
}
