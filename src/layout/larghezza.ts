import { useEffect, useState } from 'react'

/*  I punti di rottura della finestra. Stanno qui e non in una @media
 *  del CSS perché servono anche al codice: sotto i 900 px la barra
 *  laterale diventa la rotaia e ⌘\ la apre sopra il foglio invece che
 *  al suo posto; da 1200 px in su Immagini esce dal menu ⋯ della barra
 *  in alto e il percorso torna a cominciare da «Materie». */

const STRETTO = '(width < 900px)'
const LARGO = '(width >= 1200px)'

function useMedia(domanda: string) {
  const [vale, setVale] = useState(() => window.matchMedia(domanda).matches)
  useEffect(() => {
    const m = window.matchMedia(domanda)
    const cambia = () => setVale(m.matches)
    m.addEventListener('change', cambia)
    return () => m.removeEventListener('change', cambia)
  }, [domanda])
  return vale
}

/** Sotto i 900 px. */
export const useStretto = () => useMedia(STRETTO)

/** Da 1200 px in su. */
export const useLargo = () => useMedia(LARGO)
