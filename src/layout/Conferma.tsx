import { useEffect, useRef } from 'react'
import s from './Conferma.module.css'

/*  Il `confirm()` del browser è brutto, non si può vestire e blocca
 *  tutto. Per un'azione che cancella davvero dei dati vale la pena
 *  di una finestra che dica con precisione cosa sta per sparire. */

export function Conferma({
  titolo, dettaglio, azione = 'Elimina', onConferma, onAnnulla,
}: {
  titolo: string
  dettaglio?: string
  azione?: string
  onConferma: () => void
  onAnnulla: () => void
}) {
  const rif = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    rif.current?.focus()
    const giu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnnulla()
      if (e.key === 'Enter') onConferma()
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [onAnnulla, onConferma])

  return (
    <div className={s.velo} onMouseDown={onAnnulla}>
      <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className={s.titolo}>{titolo}</h2>
        {dettaglio && <p className={s.dettaglio}>{dettaglio}</p>}
        <div className={s.piede}>
          <span className={s.azioni}>
            <button className={s.annulla} onClick={onAnnulla}>Annulla</button>
            <button ref={rif} className={s.pericolo} onClick={onConferma}>{azione} <kbd className={s.tasto}>↵</kbd></button>
          </span>
        </div>
      </div>
    </div>
  )
}
