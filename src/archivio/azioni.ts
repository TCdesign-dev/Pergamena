import { apriDocumento } from '../documento/archivio'
import { mappaRegistrazioni } from '../registrazione/voci'
import { eliminaRegistrazione } from '../registrazione/registrazione'

/*  Togliere una cosa alla volta: l'audio senza la trascrizione, la
 *  trascrizione senza gli appunti. Gli appunti (la pagina intera) si
 *  eliminano come sempre, dalla pagina o dall'archivio. */

/** Solo l'audio: la trascrizione resta, e il merge funziona lo stesso. */
export async function togliAudio(documentoId: string, idRegistrazione: string) {
  await fetch(`/api/audio/${encodeURIComponent(idRegistrazione)}`, { method: 'DELETE' }).catch(() => {})
  const { doc, pronto } = apriDocumento(documentoId)
  await pronto
  mappaRegistrazioni(doc).get(idRegistrazione)?.set('audio', false)
}

/** La trascrizione, e l'audio con lei. Gli appunti restano com'erano,
 *  proposte accettate comprese. */
export async function togliTrascrizione(documentoId: string, idRegistrazione: string) {
  const { doc, pronto } = apriDocumento(documentoId)
  await pronto
  await eliminaRegistrazione(doc, idRegistrazione)
}
