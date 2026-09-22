import { useEffect, useState } from 'react'

/*  Sotto i 900 px la barra laterale diventa una colonna di icone, la
 *  rotaia, e la barra intera si apre sopra il foglio. Il punto di
 *  rottura sta qui e non in una @media del CSS perché serve anche a ⌘\:
 *  da stretti apre e chiude la barra sopra il foglio, da larghi la apre
 *  e la chiude al suo posto. */

const STRETTO = '(width < 900px)'

export function useStretto() {
  const [stretto, setStretto] = useState(() => window.matchMedia(STRETTO).matches)
  useEffect(() => {
    const m = window.matchMedia(STRETTO)
    const cambia = () => setStretto(m.matches)
    m.addEventListener('change', cambia)
    return () => m.removeEventListener('change', cambia)
  }, [])
  return stretto
}
