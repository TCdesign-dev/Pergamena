import { useEffect, useState } from 'react'
import { urlDi } from './deposito'

/** Risolve l'indirizzo di un'immagine del deposito (locale, o
 *  ripescata dal server se qui non c'è). */
export function useImmagine(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setUrl(null); return }
    let vivo = true
    void urlDi(id).then((u) => { if (vivo) setUrl(u) })
    return () => { vivo = false }
  }, [id])

  return url
}
