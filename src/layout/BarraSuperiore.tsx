import { useMemo, useState } from 'react'
import type { Quaderno, Documento } from '../documento/tipi'
import type { RifEditore } from '../editor/Editor'
import { apriDocumento } from '../documento/archivio'
import { PulsanteRegistra, registra } from '../registrazione/PulsanteRegistra'
import { AvvisoRegistrazione } from '../registrazione/AvvisoRegistrazione'
import { PannelloLezioni } from '../registrazione/PannelloLezioni'
import { useRegistrazioni } from '../registrazione/useRegistrazioni'
import { MenuPagina, type VoceMenu } from './MenuPagina'
import { useLargo } from './larghezza'
import { Icona } from '../lib/Icona'
import s from './BarraSuperiore.module.css'

/*  La barra in alto. A sinistra dove sei; a destra tre cose fisse, che
 *  non si restringono mai: la registrazione, le Lezioni, il menu ⋯.
 *  Quando manca spazio cede il percorso, e per primo il nome della
 *  pagina. Da 1200 px in su Immagini esce dal menu e sta accanto a
 *  Lezioni. Sotto la barra, sopra il margine del foglio, gli avvisi
 *  della registrazione. */

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
  // il pannello Lezioni, aperto dal suo pulsante o da «Cambia microfono»
  const [lezioniAperte, setLezioniAperte] = useState<false | 'lezioni' | 'microfono'>(false)
  const largo = useLargo()
  const materia = quaderno?.nome ?? ''

  const voci: VoceMenu[] = [
    ...(largo ? [] : [{ etichetta: 'Immagini', icona: 'immagini', tasto: '⌘/', azione: onPannello } satisfies VoceMenu]),
    { etichetta: 'Elimina pagina…', icona: 'elimina', pericolo: true, azione: onElimina },
  ]

  return (
    <header className={s.barra}>
      <nav className={s.percorso} aria-label="Percorso">
        {largo && (
          <>
            <button className={`${s.passo} ${s.materie}`} onClick={onHome}>Materie</button>
            <span className={s.sbarra}>/</span>
          </>
        )}
        {quaderno && (
          <>
            <button className={`${s.passo} ${s.materia}`} title="Scheda della materia" onClick={() => onScheda(quaderno.id)}>
              <span className={s.pallino} data-colore={quaderno.colore} />
              <span className={s.nome}>{quaderno.nome || 'Senza nome'}</span>
            </button>
            <span className={s.sbarra}>/</span>
          </>
        )}
        <span className={s.pagina} aria-current="page">{documento.titolo || 'Senza titolo'}</span>
      </nav>

      <div className={s.azioni}>
        <PulsanteRegistra documentoId={documento.id} materia={materia} rifEditore={rifEditore} />
        <button
          className={`${s.lezioni} ${lezioniAperte ? s.attivo : ''}`}
          title="Lezioni di questa pagina"
          aria-label={`Lezioni di questa pagina: ${lezioni.length}`}
          aria-expanded={lezioniAperte !== false}
          onClick={() => setLezioniAperte((v) => (v ? false : 'lezioni'))}
        >
          <Icona nome="lezioni" />
          <span>{lezioni.length}</span>
        </button>
        {largo && (
          <button
            className={`${s.icona} ${pannelloAperto ? s.attivo : ''}`}
            title="Immagini  ⌘/"
            aria-label="Pannello delle immagini"
            aria-pressed={pannelloAperto}
            onClick={onPannello}
          >
            <Icona nome="immagini" />
          </button>
        )}
        <MenuPagina voci={voci} />
      </div>

      <AvvisoRegistrazione
        documentoId={documento.id}
        onRiprendi={() => void registra(documento.id, materia, rifEditore)}
        onCambiaMicrofono={() => setLezioniAperte('microfono')}
      />

      {lezioniAperte && (
        <PannelloLezioni
          doc={doc}
          materia={materia}
          rifEditore={rifEditore}
          suMicrofono={lezioniAperte === 'microfono'}
          onChiudi={() => setLezioniAperte(false)}
        />
      )}
    </header>
  )
}
