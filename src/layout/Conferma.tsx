import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import s from './Conferma.module.css'
import { tr } from '../lingua/lingua'

/*  Il `confirm()` del browser è brutto, non si può vestire e blocca
 *  tutto. Per un'azione che cancella davvero dei dati vale la pena
 *  di una finestra che dica con precisione cosa sta per sparire.
 *
 *  Si disegna in fondo al documento, non dov'è scritta: chiesta da
 *  dentro il pannello Lezioni finiva dentro al pannello — il velo
 *  copriva 438 px invece della finestra, e la finestrella spuntava
 *  in alto a destra. Colpa dell'animazione d'entrata della tendina,
 *  che le lascia un transform: da lì in giù «fisso» vuol dire fisso
 *  rispetto a lei, non allo schermo. */

export function Conferma({
  titolo, dettaglio, azione = tr('Elimina'), onConferma, onAnnulla,
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
    // in cattura: la conferma sta sopra a tutto, e Esc e Invio sono suoi
    const giu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onAnnulla() }
      if (e.key === 'Enter') { e.preventDefault(); onConferma() }
    }
    window.addEventListener('keydown', giu, true)
    return () => window.removeEventListener('keydown', giu, true)
  }, [onAnnulla, onConferma])

  return createPortal(
    <div className={s.velo} onMouseDown={onAnnulla}>
      <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className={s.titolo}>{titolo}</h2>
        {dettaglio && <p className={s.dettaglio}>{dettaglio}</p>}
        <div className={s.piede}>
          <span className={s.azioni}>
            <button className={s.annulla} onClick={onAnnulla}>{tr('Annulla')}</button>
            <button ref={rif} className={s.pericolo} onClick={onConferma}>{azione} <kbd className={s.tasto}>↵</kbd></button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
