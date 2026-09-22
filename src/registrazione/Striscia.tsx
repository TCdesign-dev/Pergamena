import { useSyncExternalStore } from 'react'
import { iscrivitiRegistrazione, leggiRegistrazione } from './statoRegistrazione'
import s from './Striscia.module.css'

/** La frase che il riconoscitore sta ancora formando, in fondo alla
 *  pagina che si registra. Gli avvisi (interrotta, microfono muto,
 *  collegamento perso, altra finestra) stanno sotto la barra in alto. */
export function Striscia({ documentoId }: { documentoId: string }) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  if (!r.attiva || r.documentoId !== documentoId) return null

  return (
    <div className={s.striscia} aria-live="polite">
      {r.pausa ? <span className={s.attesa}>In pausa: il microfono non registra.</span>
        : r.provvisorio ? <span>{r.provvisorio}</span>
        : <span className={s.attesa}>ascolto da {r.dispositivo ?? 'microfono'}…</span>}
    </div>
  )
}
