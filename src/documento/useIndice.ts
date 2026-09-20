import { useEffect, useState } from 'react'
import { mappaQuaderni, mappaDocumenti, prontoIndice } from './archivio'
import type { Quaderno, Documento } from './tipi'

function leggi() {
  return {
    quaderni: [...mappaQuaderni.values()].sort((a, b) => a.creato - b.creato) as Quaderno[],
    documenti: [...mappaDocumenti.values()].sort((a, b) => b.modificato - a.modificato) as Documento[],
  }
}

/** Espone l'indice a React e lo tiene aggiornato a ogni modifica Yjs. */
export function useIndice() {
  const [stato, setStato] = useState(leggi)

  useEffect(() => {
    const aggiorna = () => setStato(leggi())
    mappaQuaderni.observeDeep(aggiorna)
    mappaDocumenti.observeDeep(aggiorna)
    prontoIndice.then(aggiorna)
    return () => {
      mappaQuaderni.unobserveDeep(aggiorna)
      mappaDocumenti.unobserveDeep(aggiorna)
    }
  }, [])

  return stato
}
