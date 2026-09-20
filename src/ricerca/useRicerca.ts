import { useEffect, useState } from 'react'
import { cercaNelContenuto, type Risultato } from './indice'
import type { Documento, Quaderno } from '../documento/tipi'

/** Cerca nel contenuto con un po' di ritardo: mentre scrivi non ha
 *  senso rileggere tutti i documenti a ogni lettera. */
export function useRicerca(query: string, documenti: Documento[], quaderni: Quaderno[]) {
  const [risultati, setRisultati] = useState<Risultato[]>([])

  useEffect(() => {
    if (query.trim().length < 2) {
      setRisultati([])
      return
    }
    let vivo = true
    const attesa = setTimeout(() => {
      cercaNelContenuto(query, documenti, quaderni).then((r) => {
        if (vivo) setRisultati(r)
      })
    }, 140)
    return () => {
      vivo = false
      clearTimeout(attesa)
    }
  }, [query, documenti, quaderni])

  return risultati
}
