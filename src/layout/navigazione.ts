/*  Andare a un punto degli appunti da qualunque parte dell'app: dal
 *  quiz («rileggi qui»), dal ripasso, da un argomento. App dice come si
 *  apre una pagina; l'editor, appena ha il documento, guarda se c'è un
 *  blocco da mostrare e ci porta il cursore. */

type Meta = { documentoId: string; idBlocco: string }

let apriPagina: ((id: string) => void) | null = null
let meta: Meta | null = null
const ascoltatori = new Set<() => void>()

export function registraApertura(fn: (id: string) => void) {
  apriPagina = fn
  return () => { if (apriPagina === fn) apriPagina = null }
}

export function vaiA(documentoId: string, idBlocco?: string | null) {
  meta = idBlocco ? { documentoId, idBlocco } : null
  apriPagina?.(documentoId)
  ascoltatori.forEach((f) => f())
}

/** L'editor di quel documento prende la meta, una volta sola. */
export function prendiMeta(documentoId: string): string | null {
  if (meta?.documentoId !== documentoId) return null
  const id = meta.idBlocco
  meta = null
  return id
}

export function iscrivitiNavigazione(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
