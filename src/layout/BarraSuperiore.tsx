import type { Quaderno, Documento } from '../documento/tipi'
import s from './BarraSuperiore.module.css'

/*  Una riga sottile che dice dove sei e poco altro. Serve a non
 *  perdersi quando una materia ha trenta pagine — e a tenere fuori
 *  dalla colonna di scrittura i comandi che non servono mentre scrivi. */

export function BarraSuperiore({
  quaderno, documento, pannelloAperto, onHome, onPannello, onElimina,
}: {
  quaderno: Quaderno | null
  documento: Documento
  pannelloAperto: boolean
  onHome: () => void
  onPannello: () => void
  onElimina: () => void
}) {
  return (
    <header className={s.barra}>
      <nav className={s.percorso}>
        <button className={s.passo} onClick={onHome}>Materie</button>
        {quaderno && (
          <>
            <span className={s.sbarra}>/</span>
            <span className={s.passo} data-materia>
              <span className={s.pallino} data-colore={quaderno.colore} />
              {quaderno.nome || 'Senza nome'}
            </span>
          </>
        )}
        <span className={s.sbarra}>/</span>
        <span className={s.corrente}>{documento.titolo || 'Senza titolo'}</span>
      </nav>

      <div className={s.azioni}>
        <button
          className={pannelloAperto ? s.attivo : undefined}
          title="Pannello delle immagini  ⌘/"
          onClick={onPannello}
        >
          ◫
        </button>
        <button title="Elimina questa pagina" onClick={onElimina}>⌫</button>
      </div>
    </header>
  )
}
