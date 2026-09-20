/*  Le immagini si COPIANO qui dentro, non si collegano.
 *
 *  Un link a Commons prima o poi marcisce, e senza connessione non
 *  vedresti più niente durante un ripasso. I byte vivono in
 *  IndexedDB insieme alla loro attribuzione, che per le immagini di
 *  Commons è un obbligo della licenza, non un vezzo. */

import { carica, scaricaRemota, eliminaRemota } from './deposito-remoto'

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
  caricata: boolean      // i byte sono già al sicuro sul server?
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

export async function salva(blob: Blob, meta: Omit<MetaImmagine, 'id' | 'creato' | 'tipo' | 'caricata'>) {
  const id = crypto.randomUUID()
  const voce: Voce = { ...meta, id, tipo: blob.type, creato: Date.now(), caricata: false, blob }
  await transazione('readwrite', (d) => d.put(voce))

  // il caricamento è un di più: se fallisce l'immagine c'è lo stesso,
  // e ci riprova la passata degli arretrati
  void carica(id, blob).then((fatto) => {
    if (fatto) void transazione('readwrite', (d) => d.put({ ...voce, caricata: true }))
  })

  return id
}

export async function leggi(id: string) {
  return transazione<Voce | undefined>('readonly', (d) => d.get(id))
}

export async function elimina(id: string) {
  urlCache.get(id) && URL.revokeObjectURL(urlCache.get(id)!)
  urlCache.delete(id)
  await transazione('readwrite', (d) => d.delete(id))
  void eliminaRemota(id)
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

  let blob = (await leggi(id))?.blob ?? null

  /*  Non c'è in locale: siamo su un dispositivo nuovo, o il deposito
   *  è stato svuotato. Si ripesca dal server e si rimette in cache,
   *  così la volta dopo è di nuovo istantanea e funziona offline. */
  if (!blob) {
    blob = await scaricaRemota(id)
    if (!blob) return null
    await transazione('readwrite', (d) =>
      d.put({
        id, tipo: blob!.type, larghezza: 0, altezza: 0,
        origine: '', attribuzione: '', licenza: '',
        creato: Date.now(), caricata: true, blob: blob!,
      }),
    )
  }

  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

/** Riprova a caricare le immagini rimaste indietro (eri offline, o
 *  non avevi ancora fatto l'accesso quando le hai inserite). */
export async function caricaArretrate() {
  const voci = await tutte()
  for (const v of voci) {
    if (v.caricata) continue
    if (await carica(v.id, v.blob)) {
      await transazione('readwrite', (d) => d.put({ ...v, caricata: true }))
    }
  }
}

/** Quanto occupano le immagini: serve al gestore dell'archivio (fase 4). */
export async function spazioOccupato() {
  const voci = await tutte()
  return voci.reduce((somma, v) => somma + v.blob.size, 0)
}
