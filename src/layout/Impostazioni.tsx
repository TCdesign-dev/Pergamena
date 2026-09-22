import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { iscrivitiImpostazioni, leggiImpostazioni, imposta } from '../impostazioni'
import { applicaTema, leggiTema, type Tema } from '../stili/tema'
import {
  chiudiImpostazioni, iscrivitiImpostazioniAperte, leggiImpostazioniAperte, scegliSezione, type Sezione,
} from './statoImpostazioni'
import { useStretto } from './larghezza'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './Impostazioni.module.css'

/*  Le Impostazioni: una finestra sopra tutto, su --velo. Si aprono con
 *  ⌘, dalla rotaia, dalla barra laterale e dal piede del pannello
 *  Lezioni. Sotto i 900 px una colonna sola, con le sezioni una sotto
 *  l'altra; da 900 in su due colonne, le sezioni a sinistra.
 *
 *  I valori sono quelli di sempre (impostazioni.ts e tema.ts): qui
 *  cambia solo dove si vedono. */

const SEZIONI: { id: Sezione; nome: string; icona: NomeIcona }[] = [
  { id: 'aspetto', nome: 'Aspetto', icona: 'chiaro' },
  { id: 'registrazione', nome: 'Registrazione', icona: 'microfono' },
  { id: 'immagini', nome: 'Immagini', icona: 'immagini' },
  { id: 'tastiera', nome: 'Tastiera', icona: 'tastiera' },
  { id: 'archivio', nome: 'Archivio', icona: 'archivio' },
]

export function Impostazioni({ onArchivio }: { onArchivio: () => void }) {
  const { aperta, sezione, microfono } = useSyncExternalStore(iscrivitiImpostazioniAperte, leggiImpostazioniAperte)
  if (!aperta) return null
  return <Finestra sezione={sezione} microfono={microfono} onArchivio={onArchivio} />
}

function Finestra({ sezione, microfono, onArchivio }: { sezione: Sezione; microfono: boolean; onArchivio: () => void }) {
  const stretta = useStretto()
  const rif = useRef<HTMLDivElement>(null)

  // il fuoco entra nella finestra, Esc la chiude e lo riporta dov'era
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null
    if (!microfono) rif.current?.focus()
    const giu = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      chiudiImpostazioni()
    }
    // in cattura: la finestra più in alto si prende l'Esc per prima
    window.addEventListener('keydown', giu, true)
    return () => {
      window.removeEventListener('keydown', giu, true)
      if (prima?.isConnected) prima.focus()
    }
  }, [])   // solo all'apertura: cambiando sezione il fuoco resta dov'è

  const archivio = () => { chiudiImpostazioni(); onArchivio() }
  const chiudi = (
    <>
      <kbd className={s.tasto}>esc</kbd>
      <button className={s.chiudi} title="Chiudi  esc" aria-label="Chiudi le impostazioni" onClick={chiudiImpostazioni}>
        <Icona nome="chiudi" />
      </button>
    </>
  )

  return (
    <div className={s.velo} onMouseDown={chiudiImpostazioni}>
      <div
        ref={rif}
        className={`${s.finestra} ${stretta ? s.stretta : s.larga}`}
        role="dialog"
        aria-modal="true"
        aria-label="Impostazioni"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {stretta ? (
          <>
            <header className={s.testa}>
              <span className={s.nome}>Impostazioni</span>
              {chiudi}
            </header>
            <div className={s.colonna}>
              {SEZIONI.map((x) => (
                <section key={x.id} aria-label={x.nome}>
                  <h3 className={s.etichetta}>{x.nome}</h3>
                  <Contenuto sezione={x.id} stretta microfono={microfono && x.id === 'registrazione'} onArchivio={archivio} />
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <nav className={s.sezioni} aria-label="Sezioni">
              <span className={s.nome}>Impostazioni</span>
              {SEZIONI.map((x) => (
                <button
                  key={x.id}
                  className={`${s.voce} ${x.id === sezione ? s.scelta : ''}`}
                  aria-current={x.id === sezione ? 'page' : undefined}
                  onClick={() => scegliSezione(x.id)}
                >
                  <Icona nome={x.icona} />
                  {x.nome}
                </button>
              ))}
            </nav>
            <div className={s.contenuto}>
              <header className={s.testaSezione}>
                <h2 className={s.titoloSezione}>{SEZIONI.find((x) => x.id === sezione)?.nome}</h2>
                {chiudi}
              </header>
              <Contenuto key={sezione} sezione={sezione} stretta={false} microfono={microfono} onArchivio={archivio} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Contenuto({ sezione, stretta, microfono, onArchivio }: {
  sezione: Sezione
  stretta: boolean
  microfono: boolean
  onArchivio: () => void
}) {
  switch (sezione) {
    case 'aspetto': return <Aspetto />
    case 'registrazione': return <Registrazione suMicrofono={microfono} />
    case 'immagini': return <Immagini />
    case 'tastiera': return <Tastiera stretta={stretta} />
    case 'archivio':
      return (
        <Riga titolo="Archivio" spiega="Quanto occupano materie, pagine e lezioni, e cosa togliere per fare spazio.">
          <button className={s.secondario} onClick={onArchivio}>Apri l’archivio</button>
        </Riga>
      )
  }
}

/** Una riga: titolo, spiegazione, e il controllo a destra. */
function Riga({ titolo, spiega, children }: { titolo: string; spiega?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.riga}>
      <div className={s.testo}>
        <div className={s.titoloRiga}>{titolo}</div>
        {spiega && <div className={s.spiega}>{spiega}</div>}
      </div>
      <div className={s.controllo}>{children}</div>
    </div>
  )
}

function Interruttore({ acceso, onCambia, etichetta }: { acceso: boolean; onCambia: (v: boolean) => void; etichetta: string }) {
  return (
    <button
      className={s.interruttore}
      role="switch"
      aria-checked={acceso}
      aria-label={etichetta}
      onClick={() => onCambia(!acceso)}
    />
  )
}

// ── le sezioni ─────────────────────────────────────────────────────

const TEMI: { id: Tema; nome: string; icona: NomeIcona }[] = [
  { id: 'sistema', nome: 'Sistema', icona: 'impostazioni' },
  { id: 'chiaro', nome: 'Chiaro', icona: 'chiaro' },
  { id: 'scuro', nome: 'Scuro', icona: 'scuro' },
]

function Aspetto() {
  const [tema, setTema] = useState<Tema>(leggiTema)
  return (
    <Riga titolo="Tema">
      <div className={s.segmenti} role="radiogroup" aria-label="Tema">
        {TEMI.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={tema === t.id}
            className={tema === t.id ? s.acceso : undefined}
            onClick={() => { applicaTema(t.id); setTema(t.id) }}
          >
            <Icona nome={t.icona} dimensione={14} />
            {t.nome}
          </button>
        ))}
      </div>
    </Riga>
  )
}

type Microfono = { uid: string; nome: string; virtuale: boolean; sistema: boolean }

function Registrazione({ suMicrofono }: { suMicrofono: boolean }) {
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [microfoni, setMicrofoni] = useState<Microfono[]>([])
  const rifMicrofono = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    fetch('/api/ascolto/dispositivi')
      .then((r) => r.json())
      .then((j) => setMicrofoni(Array.isArray(j.elenco) ? j.elenco : []))
      .catch(() => setMicrofoni([]))
  }, [])

  // da «Cambia microfono»: dritti alla scelta
  useEffect(() => {
    if (!suMicrofono || !microfoni.length) return
    rifMicrofono.current?.scrollIntoView({ block: 'nearest' })
    rifMicrofono.current?.focus()
  }, [suMicrofono, microfoni.length])

  const diSistema = microfoni.find((m) => m.sistema)

  return (
    <>
      <Riga titolo="Microfono" spiega="Quello che usi in aula. Vale dalla prossima registrazione.">
        <span className={s.tendina}>
          <select
            ref={rifMicrofono}
            aria-label="Microfono"
            value={impostazioni.microfono ?? ''}
            onChange={(e) => imposta('microfono', e.target.value || null)}
          >
            <option value="">Come il sistema{diSistema ? ` · ${diSistema.nome}` : ''}</option>
            {/* i virtuali in fondo: servono solo per l'audio di altre app */}
            {[...microfoni].sort((a, b) => Number(a.virtuale) - Number(b.virtuale)).map((m) => (
              <option key={m.uid} value={m.uid}>{m.nome}{m.virtuale ? ' — virtuale' : ''}</option>
            ))}
          </select>
          <Icona nome="giu" dimensione={12} className={s.freccia} />
        </span>
      </Riga>
      <Riga
        titolo="Correzioni in diretta"
        spiega="Mentre registri, un pallino a margine quando una data, un numero o un nome non torna con quello che ha detto il professore."
      >
        <Interruttore etichetta="Correzioni in diretta" acceso={impostazioni.correzioniInDiretta} onCambia={(v) => imposta('correzioniInDiretta', v)} />
      </Riga>
      <Riga titolo="Tieni anche l’audio" spiega="Circa 17 MB per ogni ora di lezione. Senza, resta solo la trascrizione.">
        <Interruttore etichetta="Tieni anche l’audio" acceso={impostazioni.salvaAudio} onCambia={(v) => imposta('salvaAudio', v)} />
      </Riga>
      <Riga titolo="Scorciatoia per registrare">
        <kbd className={s.tastoGrande}>⌘R</kbd>
      </Riga>
    </>
  )
}

function Immagini() {
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const web = impostazioni.fonteImmagini === 'web'
  return (
    <>
      <Riga
        titolo="Cerca anche sul web"
        spiega={web
          ? 'Oltre a Wikimedia Commons, immagini libere dal web, con la licenza su ognuna.'
          : 'Le immagini arrivano solo da Wikimedia Commons, con la licenza su ognuna.'}
      >
        <Interruttore etichetta="Cerca anche sul web" acceso={web} onCambia={(v) => imposta('fonteImmagini', v ? 'web' : 'commons')} />
      </Riga>
      <Riga titolo="Cerca mentre scrivi" spiega={<>Scrivi <code>!Basilica di Superga!</code> negli appunti e la ricerca parte da sola, nel pannello Immagini.</>}>
        <Interruttore etichetta="Cerca mentre scrivi" acceso={impostazioni.sintassiImmagini} onCambia={(v) => imposta('sintassiImmagini', v)} />
      </Riga>
    </>
  )
}

const SCORCIATOIE: [string, string][] = [
  ['⌘K', 'Cerca o dai un comando'],
  ['⌘\\', 'Barra laterale'],
  ['⌘R', 'Registra la lezione'],
  ['⌘/', 'Pannello delle immagini'],
  ['⌘,', 'Impostazioni'],
  ['⌥⌘↓  ⌥⌘↑', 'Segnalazione dopo, e prima'],
  ['⌘⇧↑  ⌘⇧↓', 'Sposta il blocco'],
  ['⌘⇧C', 'Colora col colore di prima'],
  ['⌘⇧0', 'Togli il colore'],
  ['/', 'Menu dei blocchi, in una riga vuota'],
  ['$$…$$', 'Formula nel testo'],
  ['!…!', 'Cerca un’immagine'],
  ['esc', 'Chiude menu e finestre'],
]

function Tastiera({ stretta }: { stretta: boolean }) {
  const [mostra, setMostra] = useState(!stretta)
  return (
    <>
      {stretta && (
        <Riga titolo="Tutte le scorciatoie">
          <button className={s.secondario} aria-expanded={mostra} onClick={() => setMostra((v) => !v)}>
            <Icona nome="tastiera" dimensione={14} />
            {mostra ? 'Nascondi' : 'Mostra'}
          </button>
        </Riga>
      )}
      {mostra && (
        <dl className={s.scorciatoie}>
          {SCORCIATOIE.map(([tasti, cosa]) => (
            <div key={tasti} className={s.scorciatoia}>
              <dt>{cosa}</dt>
              <dd>{tasti.split('  ').map((t) => <kbd key={t} className={s.tasto}>{t}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
