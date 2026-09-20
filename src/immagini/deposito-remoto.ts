import { supabase } from '../sync/cliente'

/*  I byte delle immagini in un secchio privato su Supabase.
 *
 *  Nel documento Yjs resta solo l'identificativo: didascalia,
 *  attribuzione e larghezza sono già attributi del nodo, quindi qui
 *  viaggiano soltanto i pixel. */

const SECCHIO = 'immagini'

async function percorso(id: string) {
  const { data } = await supabase!.auth.getUser()
  const uid = data.user?.id
  return uid ? `${uid}/${id}` : null
}

export async function carica(id: string, blob: Blob) {
  if (!supabase) return false
  const p = await percorso(id)
  if (!p) return false

  const { error } = await supabase.storage.from(SECCHIO).upload(p, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  })
  return !error
}

export async function scaricaRemota(id: string): Promise<Blob | null> {
  if (!supabase) return null
  const p = await percorso(id)
  if (!p) return null

  const { data, error } = await supabase.storage.from(SECCHIO).download(p)
  return error ? null : data
}

export async function eliminaRemota(id: string) {
  if (!supabase) return
  const p = await percorso(id)
  if (p) await supabase.storage.from(SECCHIO).remove([p])
}
