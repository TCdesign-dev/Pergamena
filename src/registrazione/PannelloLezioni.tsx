import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import type { Registrazione } from './tipi'
import { useRegistrazioni } from './useRegistrazioni'
import { eliminaRegistrazione } from './registrazione'
import { integraLezione, type FaseMerge } from '../merge/merge'
import { avviaRevisione } from '../merge/statoRevisione'
import { apriPannello } from '../immagini/statoPannello'
import { iscrivitiImpostazioni, leggiImpostazioni, imposta } from '../impostazioni'
import { Barra, Rotella } from '../layout/Attesa'
import { RiepilogoCorrezioni } from '../correzioni/RiepilogoCorrezioni'
import { Icona } from '../lib/Icona'
import s from './PannelloLezioni.module.css'

/*  Le lezioni registrate in questa pagina: da qui parte il merge, si
 *  legge la trascrizione, si riascolta il professore, si cancella.
 *  È anche il gestore delle trascrizioni: niente resta sul disco o
 *  sul server senza che tu possa toglierlo. */

function quando(t: number) {
  return new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
/*  Il merge dura da 4 a 30 secondi: si dice a che punto è, e da
 *  quanto si aspetta. Una frase ferma per mezzo minuto sembra un
 *  programma bloccato; una fase che cambia e i secondi che passano no. */
type Lavoro = { id: string; fase: FaseMerge | 'fatto' | 'errore'; messaggio?: string; inizio: number }

const FASI: Record<FaseMerge, string> = {
  preparo: 'Preparo la lezione…',
  chiedo: 'Il modello confronta la lezione con i tuoi appunti…',
  riprovo: 'Risposta illeggibile: riprovo…',
  inserisco: 'Inserisco le proposte…',
  immagini: 'Cerco le immagini su Commons…',
}

function Avanzamento({ lavoro }: { lavoro: Lavoro }) {
  const inCorso = lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'
  const [ora, setOra] = useState(Date.now())
  useEffect(() => {
    if (!inCorso) return
    const t = setInterval(() => setOra(Date.now()), 1000)
    return () => clearInterval(t)
  }, [inCorso])

  if (lavoro.fase === 'fatto') return <p className={`${s.stato} ${s.fatto}`}><Icona nome="accetta" dimensione={14} className={s.spunta} />{lavoro.messaggio}</p>
  if (lavoro.fase === 'errore') return <p className={`${s.stato} ${s.guasto}`}>{lavoro.messaggio}</p>

  const secondi = Math.max(0, Math.floor((ora - lavoro.inizio) / 1000))
  return (
    <div className={s.avanzamento}>
      <Barra />
      <p key={lavoro.fase} className={`${s.stato} ${s.fase}`}>
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

/** Le pause che cadono fra una frase e la successiva, per segnarle
 *  nella trascrizione: «— pausa di 12 min —». */
function pausePrima(r: Registrazione, i: number) {
  const da = i > 0 ? r.segmenti[i - 1].fine - 1 : -Infinity
  const a = r.segmenti[i].inizio
  return r.pause.filter((p) => p.a !== null && p.da >= da && p.da < a)
}

export function PannelloLezioni({ doc, materia, rifEditore, suMicrofono = false, onChiudi }: {
  doc: Y.Doc
  materia: string
  rifEditore: RifEditore
  /** aperto da «Cambia microfono»: si va dritti alla scelta del microfono */
  suMicrofono?: boolean
  onChiudi: () => void
}) {
  const lezioni = useRegistrazioni(doc)
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [aperta, setAperta] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<Lavoro | null>(null)
  const lettore = useRef<HTMLAudioElement>(null)
  const [microfoni, setMicrofoni] = useState<{ uid: string; nome: string; virtuale: boolean; sistema: boolean }[]>([])

  useEffect(() => {
    fetch('/api/ascolto/dispositivi')
      .then((r) => r.json())
      .then((j) => setMicrofoni(Array.isArray(j.elenco) ? j.elenco : []))
      .catch(() => setMicrofoni([]))
  }, [])

  const diSistema = microfoni.find((m) => m.sistema)

  const rifMicrofono = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (!suMicrofono || !microfoni.length) return
    rifMicrofono.current?.scrollIntoView({ block: 'nearest' })
    rifMicrofono.current?.focus()
  }, [suMicrofono, microfoni.length])

  async function integra(r: Registrazione) {
    const editor = rifEditore.current
    if (!editor) return
    const inizio = Date.now()
    setLavoro({ id: r.id, fase: 'preparo', inizio })
    try {
      const esito = await integraLezione(editor, doc, r.id, materia, (fase) => setLavoro({ id: r.id, fase, inizio }))
      setLavoro({
        id: r.id,
        fase: 'fatto',
        inizio,
        messaggio: esito.proposte
          ? `${esito.proposte} ${esito.proposte === 1 ? 'proposta' : 'proposte'} negli appunti`
          : 'Non manca niente di importante.',
      })
      /*  Dopo un merge si è già in modalità «sistemo gli appunti»:
       *  il pannello si apre da solo sulle immagini consigliate.
       *  Mentre scrivi, invece, non si apre mai da solo. */
      if (esito.immagini) apriPannello(true, 'consigliate')
      if (esito.proposte) { onChiudi(); avviaRevisione() }
    } catch (e) {
      setLavoro({ id: r.id, fase: 'errore', inizio, messaggio: e instanceof Error ? e.message : 'merge fallito' })
    }
  }

  function riascolta(r: Registrazione, secondo: number) {
    const a = lettore.current
    if (!a) return
    if (!a.src.includes(r.id)) a.src = `/api/audio/${encodeURIComponent(r.id)}`
    a.currentTime = Math.max(0, secondo - 1)
    void a.play()
  }

  return (
    <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
      <header className={s.testa}>
        <span className={s.titolo}>Lezioni di questa pagina</span>
        <button className={s.chiudi} title="Chiudi" aria-label="Chiudi" onClick={onChiudi}><Icona nome="chiudi" /></button>
      </header>

      {lezioni.length === 0 && (
        <p className={s.vuoto}>Nessuna lezione registrata qui. Premi <b>Registra</b> quando comincia.</p>
      )}

      <ul className={s.elenco}>
        {[...lezioni].reverse().map((r) => (
          <li key={r.id} className={s.lezione}>
            <div className={s.riga}>
              <span className={s.data}>{quando(r.inizio)}</span>
              <span className={s.misure}>
                {r.fine === null
                  ? r.pause.some((p) => p.a === null)
                    ? 'in pausa'
                    : <><span className={s.dalVivo} /> in corso</>
                  : `${minuti(r)} min · ${r.segmenti.length} ${r.segmenti.length === 1 ? 'frase' : 'frasi'}`}
                {r.audio && ' · audio'}
                {r.interrotta && (
                  <span className={s.interrotta} title="Si è fermata da sola, per esempio perché il server si è riavviato. Quello che era già trascritto è salvo.">
                    {' '}· interrotta
                  </span>
                )}
              </span>
            </div>

            {r.integrata !== null && (
              <p className={s.stato}>integrata · {r.integrata} {r.integrata === 1 ? 'proposta' : 'proposte'}</p>
            )}
            {lavoro?.id === r.id && <Avanzamento lavoro={lavoro} />}

            <div className={s.azioni}>
              {r.fine !== null && r.segmenti.length > 0 && (
                <button className={s.principale} onClick={() => void integra(r)} disabled={lavoro?.id === r.id && lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'}>
                  {lavoro?.id === r.id && lavoro.fase !== 'fatto' && lavoro.fase !== 'errore'
                    ? <><Rotella /> Integro…</>
                    : r.integrata === null ? 'Integra negli appunti' : 'Integra di nuovo'}
                </button>
              )}
              <button className={s.secondario} onClick={() => setAperta(aperta === r.id ? null : r.id)}>
                {aperta === r.id ? 'Nascondi' : 'Trascrizione'}
              </button>
              <button className={s.pericolo} onClick={() => void eliminaRegistrazione(doc, r.id)}>Elimina</button>
            </div>

            {aperta === r.id && (
              <div className={s.trascrizione}>
                {r.segmenti.map((seg, i) => (
                  <Fragment key={i}>
                    {pausePrima(r, i).map((p) => (
                      <p key={`p${p.da}`} className={s.pausaTrascritta}>
                        pausa di {quanto((p.a ?? p.da) - p.da)}
                      </p>
                    ))}
                    <p>
                      <button
                        className={s.minuto}
                        disabled={!r.audio}
                        title={r.audio ? 'Riascolta da qui' : 'Audio non salvato'}
                        onClick={() => riascolta(r, seg.inizio)}
                      >
                        {Math.floor(seg.inizio / 60)}:{String(Math.floor(seg.inizio % 60)).padStart(2, '0')}
                      </button>
                      {seg.testo}
                    </p>
                  </Fragment>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {microfoni.length > 0 && (
        <label className={s.microfono}>
          <span>Microfono</span>
          <select
            ref={rifMicrofono}
            value={impostazioni.microfono ?? ''}
            onChange={(e) => imposta('microfono', e.target.value || null)}
          >
            <option value="">Come il sistema{diSistema ? ` · ${diSistema.nome}` : ''}</option>
            {/* i virtuali in fondo: servono solo per l'audio di altre app */}
            {[...microfoni].sort((a, b) => Number(a.virtuale) - Number(b.virtuale)).map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.nome}{m.virtuale ? ' — virtuale' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={s.opzione}>
        <input
          type="checkbox"
          checked={impostazioni.salvaAudio}
          onChange={(e) => imposta('salvaAudio', e.target.checked)}
        />
        <span>Tieni anche l’audio delle prossime lezioni <em>(circa 17 MB l’ora)</em></span>
      </label>

      <label className={s.opzione}>
        <input
          type="checkbox"
          checked={impostazioni.correzioniInDiretta}
          onChange={(e) => imposta('correzioniInDiretta', e.target.checked)}
        />
        <span>Correzioni in diretta <em>— mentre registri, un pallino a margine quando una data, un numero o un nome non torna con quello che ha detto il professore</em></span>
      </label>
      <RiepilogoCorrezioni doc={doc} rifEditore={rifEditore} lezioni={lezioni} onVai={onChiudi} />

      <audio ref={lettore} className={s.lettore} controls preload="none" />
    </div>
  )
}
