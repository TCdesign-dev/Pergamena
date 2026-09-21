import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { leggiRegistrazioni, mappaRegistrazioni } from './registrazione'

/** Le registrazioni di un documento, aggiornate a ogni cambiamento. */
export function useRegistrazioni(doc: Y.Doc | null) {
  const [elenco, setElenco] = useState(() => (doc ? leggiRegistrazioni(doc) : []))
  useEffect(() => {
    if (!doc) { setElenco([]); return }
    const mappa = mappaRegistrazioni(doc)
    const aggiorna = () => setElenco(leggiRegistrazioni(doc))
    aggiorna()
    mappa.observeDeep(aggiorna)
    return () => mappa.unobserveDeep(aggiorna)
  }, [doc])
  return elenco
}
