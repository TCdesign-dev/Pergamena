import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

import './stili/token.css'
import './stili/base.css'
import './stili/editor.css'
import './stili/movimento.css'

/*  Sul telefono si consulta, sul Mac si scrive: due gusci diversi,
 *  stessi dati. La soglia è la larghezza, non il tipo di dispositivo:
 *  un iPad in orizzontale o una finestra stretta prendono quello che
 *  gli sta meglio. 600px e non di più: il pannello del browser dentro
 *  l'app Claude è largo poco più di 700, e con la soglia a 720 ogni
 *  ricaricamento apriva la vista del telefono — di sola lettura —
 *  proprio mentre prendevi appunti. Il telefono più largo ne fa 430.
 *
 *  Il caricamento è pigro apposta: così il telefono non scarica il
 *  menu «/», la palette, il pannello delle immagini e tutto il resto
 *  che serve solo a scrivere. In 4G, per una vista di sola lettura,
 *  sarebbero centinaia di kilobyte buttati. */
const telefono = window.matchMedia('(max-width: 600px)').matches

const Guscio = lazy(() =>
  telefono
    ? import('./telefono/Telefono').then((m) => ({ default: m.Telefono }))
    : import('./App').then((m) => ({ default: m.App })),
)

/*  Solo in produzione: in sviluppo un service worker litiga con il
 *  ricaricamento a caldo di Vite e serve file vecchi. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('radice')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Guscio />
    </Suspense>
  </StrictMode>,
)
