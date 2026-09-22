import { useMemo, useState } from 'react'
import type { Quaderno, Documento } from '../documento/tipi'
import type { RifEditore } from '../editor/Editor'
import { apriDocumento } from '../documento/archivio'
import { PulsanteRegistra } from '../registrazione/PulsanteRegistra'
import { PannelloLezioni } from '../registrazione/PannelloLezioni'
import { useRegistrazioni } from '../registrazione/useRegistrazioni'
import { Icona } from '../lib/Icona'
import s from './BarraSuperiore.module.css'

/*  Una riga sottile che dice dove sei e poco altro. Serve a non
 *  perdersi quando una materia ha trenta pagine — e a tenere fuori
 *  dalla colonna di scrittura i comandi che non servono mentre scrivi. */

export function BarraSuperiore({
  quaderno, documento, pannelloAperto, rifEditore, onHome, onScheda, onPannello, onElimina,
}: {
  quaderno: Quaderno | null
  documento: Documento
  pannelloAperto: boolean
  rifEditore: RifEditore
  onHome: () => void
  onScheda: (quadernoId: string) => void
  onPannello: () => void
  onElimina: () => void
}) {
  const doc = useMemo(() => apriDocumento(documento.id).doc, [documento.id])
  const lezioni = useRegistrazioni(doc)
  const [lezioniAperte, setLezioniAperte] = useState(false)

  return (
    <header className={s.barra}>
      <nav className={s.percorso}>
        <button className={s.passo} onClick={onHome}>Materie</button>
        {quaderno && (
          <>
            <span className={s.sbarra}>/</span>
            <button className={s.passo} title="Scheda della materia" onClick={() => onScheda(quaderno.id)}>
              <span className={s.pallino} data-colore={quaderno.colore} />
              <span className={s.nome}>{quaderno.nome || 'Senza nome'}</span>
            </button>
          </>
        )}
        <span className={s.sbarra}>/</span>
        <span className={s.corrente}>{documento.titolo || 'Senza titolo'}</span>
      </nav>

      <div className={s.azioni}>
        <PulsanteRegistra documentoId={documento.id} materia={quaderno?.nome ?? ''} rifEditore={rifEditore} />
        <button
          className={`${s.testo} ${lezioniAperte ? s.attivo : ''}`}
          title="Lezioni registrate in questa pagina"
          onClick={() => setLezioniAperte((v) => !v)}
        >
          Lezioni{lezioni.length ? ` · ${lezioni.length}` : ''}
        </button>
        <button
          className={`${s.icona} ${pannelloAperto ? s.attivo : ''}`}
          title="Pannello delle immagini  ⌘/"
          aria-label="Pannello delle immagini"
          onClick={onPannello}
        >
          <Icona nome="immagini" />
        </button>
        <button className={s.icona} title="Elimina questa pagina" aria-label="Elimina questa pagina" onClick={onElimina}>
          <Icona nome="elimina" />
        </button>
      </div>

      {lezioniAperte && (
        <PannelloLezioni
          doc={doc}
          materia={quaderno?.nome ?? ''}
          rifEditore={rifEditore}
          onChiudi={() => setLezioniAperte(false)}
        />
      )}
    </header>
  )
}
