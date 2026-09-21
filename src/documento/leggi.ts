import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { giaAperto } from './archivio'

/*  Leggere un documento senza aprirlo davvero.
 *
 *  Se è già in memoria (è la pagina aperta, o la ricerca l'ha appena
 *  letto) si usa quello; altrimenti una copia usa e getta da IndexedDB,
 *  chiusa subito dopo. Aprirli tutti con `apriDocumento` li terrebbe in
 *  memoria e sincronizzati per sempre: per un ripasso che legge venti
 *  pagine sarebbe uno spreco. */
export async function leggiDocumento<T>(id: string, leggi: (doc: Y.Doc) => T): Promise<T> {
  const aperto = giaAperto(id)
  if (aperto) {
    await aperto.pronto
    return leggi(aperto.doc)
  }
  const doc = new Y.Doc()
  const persistenza = new IndexeddbPersistence(`pergamena:doc:${id}`, doc)
  try {
    await persistenza.whenSynced
    return leggi(doc)
  } finally {
    await persistenza.destroy()
    doc.destroy()
  }
}
