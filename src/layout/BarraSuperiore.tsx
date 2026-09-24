import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import type { Quaderno, Documento } from '../documento/tipi'
import type { RifEditore } from '../editor/Editor'
import { apriDocumento } from '../documento/archivio'
import { PulsanteRegistra, registra } from '../registrazione/PulsanteRegistra'
import { AvvisoRegistrazione } from '../registrazione/AvvisoRegistrazione'
import { PannelloLezioni } from '../registrazione/PannelloLezioni'
import { useRegistrazioni } from '../registrazione/useRegistrazioni'
import { apriLezioni, iscrivitiLezioni, leggiLezioni } from '../registrazione/statoLezioni'
import { apriPannello, iscrivitiPannello, leggiPannello } from '../immagini/statoPannello'
import { apriCommenti, iscrivitiCommenti, leggiCommenti } from '../commenti/statoPannello'
import { apriDomande, iscrivitiDomande, leggiDomande } from '../domande/statoPannello'
import { PannelloDomande } from '../domande/PannelloDomande'
import { useDomande } from '../domande/deposito'
import { PannelloCommenti } from '../commenti/PannelloCommenti'
import { useCommenti } from '../commenti/deposito'
import { PannelloImmagini } from './PannelloImmagini'
import { apriImpostazioni } from './statoImpostazioni'
import { MenuPagina, type VoceMenu } from './MenuPagina'
import { useLargo } from './larghezza'
import { scrittaDiComando } from '../tastiera/scorciatoie'
import { Icona } from '../lib/Icona'
import s from './BarraSuperiore.module.css'

/*  La barra in alto. A sinistra dove sei; a destra tre cose fisse, che
 *  non si restringono mai: la registrazione, le Lezioni, il menu ⋯.
 *  Quando manca spazio cede il percorso, e per primo il nome della
 *  pagina. Da 1200 px in su Immagini esce dal menu e sta accanto a
 *  Lezioni. Sotto la barra, sopra il margine del foglio, gli avvisi
 *  della registrazione.
 *
 *  Lezioni, Commenti e Immagini sotto i 1200 px si aprono qui, in una
 *  tendina sotto la barra; da 1200 in su stanno nella colonna di
 *  destra, e le mette lì App.
 *
 *  Il pulsante dei commenti compare solo se ce n'è almeno uno: una
 *  pagina senza commenti non ha niente da mostrare, e la barra è già
 *  piena. */

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
  const lezioniAperte = useSyncExternalStore(iscrivitiLezioni, leggiLezioni)
  const immagini = useSyncExternalStore(iscrivitiPannello, leggiPannello).aperto
  const commentiAperti = useSyncExternalStore(iscrivitiCommenti, leggiCommenti)
  const commenti = useCommenti(doc)
  const domandeAperte = useSyncExternalStore(iscrivitiDomande, leggiDomande)
  const domande = useDomande(doc)
  const largo = useLargo()
  const materia = quaderno?.nome ?? ''
  const rifLezioni = useRef<HTMLButtonElement>(null)
  const rifCommenti = useRef<HTMLButtonElement>(null)
  const rifDomande = useRef<HTMLButtonElement>(null)

  const voci: VoceMenu[] = [
    ...(largo ? [] : [{ etichetta: 'Immagini', icona: 'immagini', tasto: scrittaDiComando('immagini'), azione: onPannello } satisfies VoceMenu]),
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
          ref={rifLezioni}
          className={`${s.lezioni} ${lezioniAperte ? s.attivo : ''}`}
          title="Lezioni di questa pagina"
          aria-label={`Lezioni di questa pagina: ${lezioni.length}`}
          aria-expanded={lezioniAperte}
          onClick={() => apriLezioni(!lezioniAperte)}
        >
          <Icona nome="lezioni" />
          <span>{lezioni.length}</span>
        </button>
        {(lezioni.length > 0 || domande.length > 0) && (
          <button
            ref={rifDomande}
            className={`${s.icona} ${domandeAperte ? s.attivo : ''}`}
            title={`Chiedi alla lezione  ${scrittaDiComando('chiedi')}`}
            aria-label="Chiedi alla lezione"
            aria-expanded={domandeAperte}
            onClick={() => apriDomande(!domandeAperte)}
          >
            <Icona nome="domanda" />
          </button>
        )}
        {commenti.length > 0 && (
          <button
            ref={rifCommenti}
            className={`${s.lezioni} ${commentiAperti ? s.attivo : ''}`}
            title="Commenti di questa pagina"
            aria-label={`Commenti di questa pagina: ${commenti.length}`}
            aria-expanded={commentiAperti}
            onClick={() => apriCommenti(!commentiAperti)}
          >
            <Icona nome="commento" />
            <span>{commenti.length}</span>
          </button>
        )}
        {largo && (
          <button
            className={`${s.icona} ${pannelloAperto ? s.attivo : ''}`}
            title={`Immagini  ${scrittaDiComando('immagini')}`}
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
        onCambiaMicrofono={() => apriImpostazioni('registrazione', true)}
      />

      {!largo && lezioniAperte && (
        <Tendina escludi={rifLezioni} onChiudi={() => apriLezioni(false)}>
          <PannelloLezioni doc={doc} materia={materia} rifEditore={rifEditore} modo="tendina" onChiudi={() => apriLezioni(false)} />
        </Tendina>
      )}
      {!largo && domandeAperte && (
        <Tendina alta escludi={rifDomande} onChiudi={() => apriDomande(false)}>
          <PannelloDomande doc={doc} rifEditore={rifEditore} materia={materia} modo="tendina" onChiudi={() => apriDomande(false)} />
        </Tendina>
      )}
      {!largo && commentiAperti && (
        <Tendina escludi={rifCommenti} onChiudi={() => apriCommenti(false)}>
          <PannelloCommenti doc={doc} rifEditore={rifEditore} modo="tendina" onChiudi={() => apriCommenti(false)} />
        </Tendina>
      )}
      {!largo && immagini && (
        <Tendina alta onChiudi={() => apriPannello(false)}>
          <PannelloImmagini key={documento.id} rifEditore={rifEditore} doc={doc} materia={materia} />
        </Tendina>
      )}
    </header>
  )
}

/*  La tendina sotto la barra: la superficie fluttuante, larga fino a
 *  440 px, agganciata a destra. Si chiude con Esc o con un clic fuori
 *  (non sul pulsante che la apre e chiude: ci pensa lui). */
function Tendina({ alta = false, escludi, onChiudi, children }: {
  /** alta quanto può: il pannello delle immagini ha le sue schede che scorrono */
  alta?: boolean
  escludi?: RefObject<HTMLElement | null>
  onChiudi: () => void
  children: ReactNode
}) {
  const rif = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fuori = (e: MouseEvent) => {
      const dove = e.target as Node
      if (rif.current?.contains(dove) || escludi?.current?.contains(dove)) return
      onChiudi()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onChiudi()
    }
    window.addEventListener('mousedown', fuori)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', fuori)
      window.removeEventListener('keydown', esc)
    }
  }, [escludi, onChiudi])

  return (
    <div ref={rif} className={`${s.tendina} ${alta ? s.alta : ''}`}>
      {children}
    </div>
  )
}
