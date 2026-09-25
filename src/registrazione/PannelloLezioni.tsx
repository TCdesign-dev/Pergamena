import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { Editor } from '@tiptap/core'
import type { RifEditore } from '../editor/Editor'
import type { Registrazione } from './tipi'
import { useRegistrazioni } from './useRegistrazioni'
import { eliminaRegistrazione } from './registrazione'
import { integraLezione, integraTutto, type EsitoMerge, type FaseMerge } from '../merge/merge'
import { avviaRevisione } from '../merge/statoRevisione'
import { apriPannello } from '../immagini/statoPannello'
import { iscrivitiImpostazioni, leggiImpostazioni } from '../impostazioni'
import { iscrivitiStatoCorrezioni, leggiStatoCorrezioni } from '../correzioni/statoCorrezioni'
import { apriImpostazioni } from '../layout/statoImpostazioni'
import { Barra, Rotella } from '../layout/Attesa'
import { Conferma } from '../layout/Conferma'
import { MenuPagina } from '../layout/MenuPagina'
import { CorrezioniInAttesa, ContiCorrezioni } from '../correzioni/RiepilogoCorrezioni'
import { Icona } from '../lib/Icona'
import s from './PannelloLezioni.module.css'
import { locale, tr } from '../lingua/lingua'

/*  Le lezioni registrate in questa pagina: da qui parte il merge, si
 *  legge la trascrizione, si riascolta il professore, si cancella.
 *  È anche il gestore delle trascrizioni: niente resta sul disco o
 *  sul server senza che tu possa toglierlo.
 *
 *  Sotto i 1200 px è una tendina sotto a «Lezioni»; da 1200 in su sta
 *  nella colonna di destra, su --carta-alt. Microfono, audio e
 *  correzioni in diretta si scelgono nelle Impostazioni: qui in fondo
 *  si vede soltanto come sono messi. */

type Microfono = { uid: string; nome: string; virtuale: boolean; sistema: boolean }

function quando(t: number) {
  const d = new Date(t).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

/*  Il merge dura da 4 a 30 secondi: si dice a che punto è, e da
 *  quanto si aspetta. Una frase ferma per mezzo minuto sembra un
 *  programma bloccato; una fase che cambia e i secondi che passano no. */
type Lavoro = { id: string; fase: FaseMerge | 'fatto' | 'errore'; messaggio?: string; inizio: number }

/** Il lavoro che non è di UNA lezione, ma di tutte insieme. */
const TUTTE = 'tutte-le-lezioni'

const FASI: Record<FaseMerge, string> = {
  preparo: tr('Preparo la lezione…'),
  chiedo: tr('Il modello confronta la lezione con i tuoi appunti…'),
  riprovo: tr('Risposta illeggibile: riprovo…'),
  inserisco: tr('Inserisco le proposte…'),
  immagini: tr('Cerco le immagini su Commons…'),
}

function Avanzamento({ lavoro }: { lavoro: Lavoro }) {
  const inCorso = lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'
  const [ora, setOra] = useState(Date.now())
  useEffect(() => {
    if (!inCorso) return
    const t = setInterval(() => setOra(Date.now()), 1000)
    return () => clearInterval(t)
  }, [inCorso])

  if (lavoro.fase === 'fatto') return <p className={`${s.avviso} ${s.fatto}`}><Icona nome="accetta" dimensione={14} />{lavoro.messaggio}</p>
  if (lavoro.fase === 'errore') return <p className={`${s.avviso} ${s.guasto}`}>{lavoro.messaggio}</p>

  const secondi = Math.max(0, Math.floor((ora - lavoro.inizio) / 1000))
  return (
    <div className={s.avanzamento}>
      <Barra />
      <p key={lavoro.fase} className={s.avviso}>
        {FASI[lavoro.fase]}
        {secondi >= 2 && <span className={s.secondi}>{secondi} s</span>}
      </p>
    </div>
  )
}

/** La durata della lezione registrata: senza le pause. */
function minuti(r: Registrazione) {
  const fine = r.segmenti.length ? r.segmenti[r.segmenti.length - 1].fine : 0
  const inPausa = r.pause.reduce((t, p) => t + (p.a === null ? 0 : p.a - p.da), 0)
  return Math.max(1, Math.round((fine - inPausa) / 60))
}

const quanto = (secondi: number) => secondi < 60 ? `${Math.round(secondi)} s` : `${Math.round(secondi / 60)} min`
const tempo = (secondi: number) => `${Math.floor(secondi / 60)}:${String(Math.floor(secondi % 60)).padStart(2, '0')}`

/** Le pause che cadono fra una frase e la successiva, per segnarle
 *  nella trascrizione: «— pausa di 12 min —». */
function pausePrima(r: Registrazione, i: number) {
  const da = i > 0 ? r.segmenti[i - 1].fine - 1 : -Infinity
  const a = r.segmenti[i].inizio
  return r.pause.filter((p) => p.a !== null && p.da >= da && p.da < a)
}

// quante frasi si vedono aprendo la trascrizione; le altre a richiesta
const PRIME = 5

export function PannelloLezioni({ doc, materia, rifEditore, modo, onChiudi }: {
  doc: Y.Doc
  materia: string
  rifEditore: RifEditore
  /** tendina sotto a «Lezioni», o colonna di destra da 1200 px */
  modo: 'tendina' | 'lato'
  onChiudi: () => void
}) {
  const lezioni = useRegistrazioni(doc)
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const correzioni = useSyncExternalStore(iscrivitiStatoCorrezioni, leggiStatoCorrezioni)
  const [aperta, setAperta] = useState<string | null>(null)
  const [tutte, setTutte] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<Lavoro | null>(null)
  const [daEliminare, setDaEliminare] = useState<Registrazione | null>(null)
  const lettore = useRef<HTMLAudioElement>(null)
  const [microfoni, setMicrofoni] = useState<Microfono[]>([])

  useEffect(() => {
    fetch('/api/ascolto/dispositivi')
      .then((r) => r.json())
      .then((j) => setMicrofoni(Array.isArray(j.elenco) ? j.elenco : []))
      .catch(() => setMicrofoni([]))
  }, [])

  // Esc chiude, se non c'è una conferma aperta sopra
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || daEliminare) return
      onChiudi()
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [onChiudi, daEliminare])

  /** Il merge di una lezione sola, o di tutte insieme: cambia solo
   *  chi lo fa; l'attesa, l'esito e la revisione sono gli stessi. */
  async function integra(id: string, fai: (editor: Editor, avanza: (f: FaseMerge) => void) => Promise<EsitoMerge>) {
    const editor = rifEditore.current
    if (!editor) return
    const inizio = Date.now()
    setLavoro({ id, fase: 'preparo', inizio })
    try {
      const esito = await fai(editor, (fase) => setLavoro({ id, fase, inizio }))
      setLavoro({
        id,
        fase: 'fatto',
        inizio,
        messaggio: esito.proposte
          ? tr('{n} proposta negli appunti | {n} proposte negli appunti', { n: esito.proposte })
          : tr('Non manca niente di importante.'),
      })
      /*  Dopo un merge si è già in modalità «sistemo gli appunti»:
       *  il pannello si apre da solo sulle immagini consigliate.
       *  Mentre scrivi, invece, non si apre mai da solo. */
      if (esito.immagini) apriPannello(true, 'consigliate')
      if (esito.proposte) { onChiudi(); avviaRevisione() }
    } catch (e) {
      setLavoro({ id, fase: 'errore', inizio, messaggio: e instanceof Error ? e.message : tr('merge fallito') })
    }
  }

  const integraUna = (r: Registrazione) =>
    integra(r.id, (editor, avanza) => integraLezione(editor, doc, r.id, materia, avanza))
  const integraTutte = () =>
    integra(TUTTE, (editor, avanza) => integraTutto(editor, doc, materia, avanza))

  function riascolta(r: Registrazione, secondo: number) {
    const a = lettore.current
    if (!a) return
    if (!a.src.includes(r.id)) a.src = `/api/audio/${encodeURIComponent(r.id)}`
    a.currentTime = Math.max(0, secondo - 1)
    void a.play()
  }

  function scaricaAudio(r: Registrazione) {
    const a = document.createElement('a')
    a.href = `/api/audio/${encodeURIComponent(r.id)}`
    a.download = `Lezione ${quando(r.inizio).replace(/[/:]/g, '.')}.m4a`
    a.click()
  }

  // il piede: com'è messo il microfono, e le correzioni
  const microfono = impostazioni.microfono
    ? microfoni.find((m) => m.uid === impostazioni.microfono)?.nome
    : microfoni.find((m) => m.sistema)?.nome
  const statoCorrezioni = !impostazioni.correzioniInDiretta ? tr('correzioni in diretta spente')
    : correzioni.fermo === 'credito' ? tr('correzioni in diretta ferme')
    : tr('correzioni in diretta attive')

  // le lezioni finite che hanno del parlato: quelle che si possono rileggere insieme
  const insieme = lezioni.filter((r) => r.fine !== null && r.segmenti.length > 0)
  const inCorso = !!lavoro && lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'
  const tutteInCorso = inCorso && lavoro?.id === TUTTE

  return (
    <div className={s.pannello} data-modo={modo}>
      <header className={s.testa}>
        <span className={s.titolo}>{modo === 'lato' ? tr('Lezioni') : tr('Lezioni di questa pagina')}</span>
        <span className={s.numero}>{lezioni.length}</span>
        <button className={s.chiudi} title={tr('Chiudi  esc')} aria-label={tr('Chiudi il pannello delle lezioni')} onClick={onChiudi}>
          <Icona nome="chiudi" />
        </button>
      </header>

      <div className={s.corpo}>
        <CorrezioniInAttesa doc={doc} rifEditore={rifEditore} onVai={modo === 'tendina' ? onChiudi : () => {}} />

        {lezioni.length === 0 && (
          <p className={s.vuoto}>Nessuna lezione registrata qui. Premi <b>{tr('Registra')}</b> quando comincia.</p>
        )}

        <ul className={s.elenco}>
          {[...lezioni].reverse().map((r) => {
            const occupata = lavoro?.id === r.id && lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'
            const finita = r.fine !== null
            const aperte = aperta === r.id
            const frasi = aperte ? (tutte === r.id ? r.segmenti : r.segmenti.slice(0, PRIME)) : []
            return (
              <li key={r.id} className={`${s.lezione} ${aperte ? s.aperta : ''}`}>
                <div className={s.riga}>
                  <span className={s.data}>{quando(r.inizio)}</span>
                  <span className={s.misure}>
                    {finita
                      ? `${minuti(r)} min · ${r.segmenti.length} ${r.segmenti.length === 1 ? 'frase' : 'frasi'}`
                      : r.pause.some((p) => p.a === null) ? tr('in pausa') : tr('si sta registrando')}
                    {r.interrotta && (
                      <span className={s.interrotta} title={tr('Si è fermata da sola, per esempio perché il server si è riavviato. Quello che era già trascritto è salvo.')}>
                        {' '}· interrotta
                      </span>
                    )}
                  </span>
                  <span className={s.stato}>
                    {!finita ? <><span className={s.dalVivo} />{tr('in corso')}</>
                      : r.integrata !== null || r.insieme !== null ? (
                        <span
                          className={s.integrata}
                          title={r.integrata !== null
                            ? tr('{n} proposta | {n} proposte', { n: r.integrata })
                            : tr('Integrata insieme alle altre lezioni della pagina')}
                        >
                          <Icona nome="accetta" dimensione={12} />{tr('Integrata')}
                        </span>
                      )
                      : r.segmenti.length > 0 ? <><span className={s.daIntegrare} />{tr('Da integrare')}</>
                      : null}
                  </span>
                </div>

                {lavoro?.id === r.id && <Avanzamento lavoro={lavoro} />}

                <div className={s.azioni}>
                  {finita && r.segmenti.length > 0 && (
                    <button
                      className={r.integrata === null && r.insieme === null ? s.principale : s.secondario}
                      onClick={() => void integraUna(r)}
                      disabled={occupata}
                    >
                      {occupata ? <Rotella /> : <Icona nome="ai" dimensione={14} />}
                      {occupata ? tr('Integro…') : r.integrata === null && r.insieme === null ? tr('Integra negli appunti') : tr('Integra di nuovo')}
                    </button>
                  )}
                  <button
                    className={aperte ? s.secondario : s.trasparente}
                    aria-expanded={aperte}
                    onClick={() => { setAperta(aperte ? null : r.id); setTutte(null) }}
                  >
                    <Icona nome="trascrizione" dimensione={14} />
                    {tr('Trascrizione')}
                  </button>
                  <span className={s.spazio} />
                  <MenuPagina
                    etichetta={tr('Altre azioni sulla lezione')}
                    voci={[
                      ...(r.audio ? [{ etichetta: tr('Scarica l’audio'), icona: 'scarica' as const, azione: () => scaricaAudio(r) }] : []),
                      { etichetta: tr('Elimina la lezione…'), icona: 'elimina', pericolo: true, staccata: r.audio, azione: () => setDaEliminare(r) },
                    ]}
                  />
                </div>

                {aperte && (
                  <div className={s.trascrizione}>
                    {r.segmenti.length === 0 && <p className={s.nessuna}>{tr('Ancora nessuna frase.')}</p>}
                    {frasi.map((seg, i) => (
                      <Fragment key={i}>
                        {pausePrima(r, i).map((p) => (
                          <p key={`p${p.da}`} className={s.pausaTrascritta}>
                            pausa di {quanto((p.a ?? p.da) - p.da)}
                          </p>
                        ))}
                        <p className={s.frase}>
                          {r.audio
                            ? <button className={s.minuto} title={tr('Riascolta da qui')} onClick={() => riascolta(r, seg.inizio)}>{tempo(seg.inizio)}</button>
                            : <span className={s.minuto}>{tempo(seg.inizio)}</span>}
                          <span>{seg.testo}</span>
                        </p>
                      </Fragment>
                    ))}
                    {tutte !== r.id && r.segmenti.length > PRIME && (
                      <button className={s.tutte} onClick={() => setTutte(r.id)}>
                        Mostra tutte le {r.segmenti.length} frasi <Icona nome="giu" dimensione={12} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {insieme.length > 1 && (
          <div className={s.insieme}>
            <b className={s.insiemeTitolo}>{tr('Integrazione completa')}</b>
            <p className={s.insiemeTesto}>
              Rilegge le {insieme.length} lezioni insieme, invece di una alla volta: ciò che il
              professore ha ripreso da una lezione all’altra diventa una proposta sola.
            </p>
            {lavoro?.id === TUTTE && <Avanzamento lavoro={lavoro} />}
            <button className={s.secondario} onClick={() => void integraTutte()} disabled={inCorso}>
              {tutteInCorso ? <Rotella /> : <Icona nome="ai" dimensione={14} />}
              {tutteInCorso ? tr('Integro…') : tr('Integra tutte le lezioni')}
            </button>
          </div>
        )}

        <ContiCorrezioni lezioni={lezioni} />
        <audio ref={lettore} className={s.lettore} controls preload="none" />
      </div>

      <footer className={s.piede}>
        <Icona nome="microfono" dimensione={14} />
        <span className={s.come}>
          {/* «Microfono MacBook Pro» si chiama già così: niente «Microfono» due volte */}
          {!microfono ? `Microfono ${impostazioni.microfono ? 'scelto' : 'di sistema'}`
            : /^microfono\b/i.test(microfono) ? microfono : `Microfono ${microfono}`} · {statoCorrezioni}
        </span>
        <button className={s.impostazioni} onClick={() => apriImpostazioni('registrazione')}>
          <Icona nome="impostazioni" dimensione={14} />
          {tr('Impostazioni')}
        </button>
      </footer>

      {daEliminare && (
        <Conferma
          titolo={tr('Eliminare la lezione di {quando}?', { quando: quando(daEliminare.inizio) })}
          dettaglio={daEliminare.audio
            ? tr('Spariscono la trascrizione, l’audio e le correzioni ancora aperte di questa lezione. Gli appunti restano come sono.')
            : tr('Spariscono la trascrizione e le correzioni ancora aperte di questa lezione. Gli appunti restano come sono.')}
          onConferma={() => { const r = daEliminare; setDaEliminare(null); void eliminaRegistrazione(doc, r.id) }}
          onAnnulla={() => setDaEliminare(null)}
        />
      )}
    </div>
  )
}
