import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Sincronia, stanzaRegistrata } from './sincronia'
import { caricaArretrate } from '../immagini/deposito'

/*  Passata di salvataggio su TUTTI i documenti, non solo su quello
 *  aperto.
 *
 *  Senza questa, la sincronia copre solo ciò che apri: un documento
 *  che non tocchi da settimane non arriverebbe mai sul server, e se
 *  il Mac muore quella lezione è persa. È esattamente il caso in cui
 *  un backup deve esserci, ed è il caso in cui non ci sarebbe.
 *
 *  Funziona anche al contrario: su un Mac nuovo l'indice arriva per
 *  primo, e questa passata tira giù tutti i documenti elencati.
 *
 *  Si procede uno alla volta, aprendo e richiudendo: tenere in
 *  memoria trecento documenti Yjs per fare un backup sarebbe assurdo. */

const RESPIRO = 150   // ms fra un documento e il successivo

let inCorso = false

export async function allineaTutto(idDocumenti: string[]) {
  if (inCorso) return
  inCorso = true

  try {
    // prima le immagini: sono quelle che si perdono davvero,
    // perché i byte non stanno nel documento Yjs
    await caricaArretrate()

    for (const id of idDocumenti) {
      // quello aperto nell'editor ha già la sua sincronia attiva
      if (stanzaRegistrata(`doc:${id}`)) continue

      const doc = new Y.Doc()
      const locale = new IndexeddbPersistence(`pergamena:doc:${id}`, doc)

      try {
        await locale.whenSynced
        const sinc = new Sincronia(`doc:${id}`, doc)
        await sinc.avvia()     // scarica il remoto e spedisce il delta locale
        sinc.ferma()
      } finally {
        await locale.destroy()
        doc.destroy()
      }

      await new Promise((r) => setTimeout(r, RESPIRO))
    }
  } finally {
    inCorso = false
  }
}
