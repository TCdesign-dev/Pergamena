import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { iscrivitiImpostazioni, leggiImpostazioni, imposta } from '../impostazioni'
import { impostaChiave, intestazioniChiavi, iscrivitiChiavi, leggiChiavi, type Chiavi as ChiaviTipo } from '../chiavi'
import { ISTRUZIONI_DI_SERIE } from '../merge/prompt'
import {
  COMANDI, azzeraScorciatoie, combinazioneDa, combinazioneDi, giaPresa, impostaScorciatoia, scrittaDi,
} from '../tastiera/scorciatoie'
import { applicaTema, leggiTema, type Tema } from '../stili/tema'
import {
  chiudiImpostazioni, iscrivitiImpostazioniAperte, leggiImpostazioniAperte, scegliSezione, type Sezione,
} from './statoImpostazioni'
import { useStretto } from './larghezza'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './Impostazioni.module.css'
import { cambiaLingua, lingue, tr } from '../lingua/lingua'
import { Tr } from '../lingua/Tr'

/*  Le Impostazioni: una finestra sopra tutto, su --velo. Si aprono con
 *  ⌘, dalla rotaia, dalla barra laterale e dal piede del pannello
 *  Lezioni. Sotto i 900 px una colonna sola, con le sezioni una sotto
 *  l'altra; da 900 in su due colonne, le sezioni a sinistra.
 *
 *  I valori sono quelli di sempre (impostazioni.ts e tema.ts): qui
 *  cambia solo dove si vedono. */

const SEZIONI: { id: Sezione; nome: string; icona: NomeIcona }[] = [
  { id: 'aspetto', nome: tr('Aspetto'), icona: 'chiaro' },
  { id: 'registrazione', nome: tr('Registrazione'), icona: 'microfono' },
  { id: 'integratore', nome: tr('Integratore'), icona: 'ai' },
  { id: 'chiavi', nome: tr('Chiavi'), icona: 'chiave' },
  { id: 'immagini', nome: tr('Immagini'), icona: 'immagini' },
  { id: 'tastiera', nome: tr('Tastiera'), icona: 'tastiera' },
  { id: 'archivio', nome: tr('Archivio'), icona: 'archivio' },
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
      <button className={s.chiudi} title={tr('Chiudi  esc')} aria-label={tr('Chiudi le impostazioni')} onClick={chiudiImpostazioni}>
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
        aria-label={tr('Impostazioni')}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {stretta ? (
          <>
            <header className={s.testa}>
              <span className={s.nome}>{tr('Impostazioni')}</span>
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
            <nav className={s.sezioni} aria-label={tr('Sezioni')}>
              <span className={s.nome}>{tr('Impostazioni')}</span>
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
    case 'integratore': return <Integratore />
    case 'chiavi': return <Chiavi />
    case 'immagini': return <Immagini />
    case 'tastiera': return <Tastiera stretta={stretta} />
    case 'archivio':
      return (
        <Riga titolo={tr('Archivio')} spiega={tr('Quanto occupano materie, pagine e lezioni, e cosa togliere per fare spazio.')}>
          <button className={s.secondario} onClick={onArchivio}>{tr('Apri l’archivio')}</button>
        </Riga>
      )
  }
}

/** Una riga: titolo, spiegazione, e il controllo a destra. Il
 *  controllo può mancare: certe righe sono solo l'intestazione di
 *  quello che viene sotto. */
function Riga({ titolo, spiega, children }: { titolo: string; spiega?: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.riga}>
      <div className={s.testo}>
        <div className={s.titoloRiga}>{titolo}</div>
        {spiega && <div className={s.spiega}>{spiega}</div>}
      </div>
      {children && <div className={s.controllo}>{children}</div>}
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
  { id: 'sistema', nome: tr('Sistema'), icona: 'impostazioni' },
  { id: 'chiaro', nome: tr('Chiaro'), icona: 'chiaro' },
  { id: 'scuro', nome: tr('Scuro'), icona: 'scuro' },
]

/*  La lingua compare solo se ce n'è più d'una installata: con il solo
 *  italiano sarebbe una tendina con dentro una voce. */
function Lingua() {
  const elenco = lingue()
  const scelta = leggiImpostazioni().lingua
  if (elenco.length < 2) return null
  return (
    <Riga
      titolo={tr('Lingua')}
      spiega={<Tr frase="Le traduzioni le scrive chi usa Pergamena. Se la tua lingua non c’è, o c’è e va corretta, si aggiunge un file in <code>lingue/</code>." />}
    >
      <span className={s.tendina}>
        <select
          aria-label={tr('Lingua')}
          value={scelta ?? ''}
          onChange={(e) => cambiaLingua(e.target.value || null)}
        >
          <option value="">{tr('Come il sistema')}</option>
          {elenco.map((l) => <option key={l.codice} value={l.codice}>{l.nome}</option>)}
        </select>
        <Icona nome="giu" dimensione={12} className={s.freccia} />
      </span>
    </Riga>
  )
}

function Aspetto() {
  const [tema, setTema] = useState<Tema>(leggiTema)
  return (
    <>
    <Riga titolo={tr('Tema')}>
      <div className={s.segmenti} role="radiogroup" aria-label={tr('Tema')}>
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
    <Lingua />
    </>
  )
}

/*  Le istruzioni che l'integratore riceve prima dei tuoi appunti.
 *
 *  Si possono riscrivere: è il modo più diretto di dirgli come vuoi
 *  che lavori («niente definizioni», «solo numeri e date», «scrivi in
 *  inglese»). Quello che il programma aggiunge sempre — titoli,
 *  immagini, formato della risposta — resta fuori da qui: se lo
 *  rompessi, il merge non tornerebbe con proposte brutte, tornerebbe
 *  con zero proposte. */
function Integratore() {
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const suo = impostazioni.promptMerge
  const [bozza, setBozza] = useState(suo ?? ISTRUZIONI_DI_SERIE)
  const cambiato = bozza.trim() !== (suo ?? ISTRUZIONI_DI_SERIE).trim()
  const diSerie = bozza.trim() === ISTRUZIONI_DI_SERIE.trim()

  const salva = () => imposta('promptMerge', bozza.trim() && !diSerie ? bozza.trim() : null)

  return (
    <>
      <Riga
        titolo={tr('Le istruzioni per l’integratore')}
        spiega={<Tr
          frase="Sono la prima cosa che il modello legge, prima dei tuoi appunti e della trascrizione. {segnaposto} diventa il numero massimo di proposte: 8 per una lezione, 16 per tutte insieme."
          valori={{ segnaposto: <code>{'{massimo}'}</code> }}
        />}
      />
      <textarea
        className={s.prompt}
        value={bozza}
        spellCheck={false}
        onChange={(e) => setBozza(e.target.value)}
        onBlur={salva}
        aria-label={tr('Le istruzioni per l’integratore')}
      />
      <div className={s.sottoPrompt}>
        <span className={s.nota}>
          {suo ? tr('Stai usando istruzioni tue.') : tr('Stai usando le istruzioni di serie.')}
          {' '}Dopo, il programma aggiunge sempre titoli, immagini e formato della risposta.
        </span>
        <span className={s.tastiPrompt}>
          <button className={s.secondario} disabled={diSerie} onClick={() => { setBozza(ISTRUZIONI_DI_SERIE); imposta('promptMerge', null) }}>
            Ripristina
          </button>
          <button className={s.principale} disabled={!cambiato} onClick={salva}>{tr('Salva')}</button>
        </span>
      </div>
    </>
  )
}

/*  Le chiavi, per chi non vuole aprire il .env.local.
 *
 *  Restano su questo computer (localStorage) e vanno solo al server
 *  locale, che è l'unico che parla con OpenRouter. Se una chiave c'è
 *  anche nel file, vince quella e il campo si spegne: il file sta
 *  fuori dal browser, ed è il posto più sicuro dei due. */
function CampoChiave({ nome, titolo, spiega, dalFile = false, tipo = 'password', children }: {
  nome: keyof ChiaviTipo
  titolo: string
  spiega: ReactNode
  dalFile?: boolean
  tipo?: 'password' | 'text'
  children?: ReactNode
}) {
  const chiavi = useSyncExternalStore(iscrivitiChiavi, leggiChiavi)
  return (
    <div className={s.campoChiave}>
      <div className={s.titoloRiga}>{titolo}</div>
      <div className={s.spiega}>{spiega}</div>
      <div className={s.rigaChiave}>
        <input
          className={s.chiave}
          type={dalFile ? 'text' : tipo}
          value={dalFile ? '' : chiavi[nome]}
          disabled={dalFile}
          spellCheck={false}
          autoComplete="off"
          placeholder={dalFile ? tr('c’è già nel .env.local') : tr('incolla qui')}
          aria-label={titolo}
          onChange={(e) => impostaChiave(nome, e.target.value)}
        />
        {children}
      </div>
    </div>
  )
}

function Chiavi() {
  const chiavi = useSyncExternalStore(iscrivitiChiavi, leggiChiavi)
  const [dalFile, setDalFile] = useState(false)
  const [prova, setProva] = useState<string | null>(null)
  const [inProva, setInProva] = useState(false)

  useEffect(() => {
    fetch('/api/llm/stato')
      .then((r) => r.json())
      .then((j) => setDalFile(Boolean(j.chiaveDalFile)))
      .catch(() => setDalFile(false))
  }, [])

  async function provaChiave() {
    setInProva(true)
    setProva(null)
    try {
      const r = await fetch('/api/llm/prova', { headers: intestazioniChiavi() })
      const j = await r.json()
      if (!j.ok) setProva(tr('non va: {motivo}', { motivo: j.errore ?? tr('chiave rifiutata') }))
      else {
        setProva(typeof j.residuo === 'number'
          ? tr('la chiave risponde, {soldi} $ residui', { soldi: j.residuo.toFixed(2) })
          : tr('la chiave risponde'))
      }
    } catch {
      setProva(tr('il server locale non risponde'))
    }
    setInProva(false)
  }

  return (
    <>
      <CampoChiave
        nome="openrouter"
        titolo={tr('OpenRouter')}
        dalFile={dalFile}
        spiega={<Tr frase="Serve all’integratore, ai quiz e alle correzioni in diretta. Si prende su <code>openrouter.ai/keys</code>: qualche centesimo al mese ai ritmi di una persona che studia." />}
      >
        <button className={s.secondario} disabled={inProva || (!dalFile && !chiavi.openrouter)} onClick={() => void provaChiave()}>
          {inProva ? tr('Provo…') : tr('Prova')}
        </button>
      </CampoChiave>
      {prova && <p className={s.esitoChiave}>{prova}</p>}

      <CampoChiave
        nome="serper"
        titolo={tr('Serper (facoltativa)')}
        spiega={tr('Dà le immagini di Google al posto di Openverse. Senza, le immagini arrivano lo stesso da Wikipedia e Commons.')}
      />

      <CampoChiave
        nome="supabaseUrl"
        titolo={tr('Supabase — indirizzo (facoltativo)')}
        tipo="text"
        spiega={<Tr frase="Per sincronizzare Mac e telefono. Finisce per <code>.supabase.co</code>." />}
      />
      <CampoChiave
        nome="supabaseAnon"
        titolo={tr('Supabase — chiave pubblica')}
        spiega={<Tr frase="Quella con l’etichetta <b>anon public</b>. Non la <b>service_role</b>: quella scavalca ogni regola di accesso e qui non avrebbe dove stare al sicuro." />}
      />
      <p className={s.esitoChiave}>
        {tr('Le chiavi restano su questo computer e vanno solo al server locale. Supabase entra in funzione al prossimo caricamento della pagina.')}
      </p>
    </>
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
      <Riga titolo={tr('Microfono')} spiega={tr('Quello che usi in aula. Vale dalla prossima registrazione.')}>
        <span className={s.tendina}>
          <select
            ref={rifMicrofono}
            aria-label={tr('Microfono')}
            value={impostazioni.microfono ?? ''}
            onChange={(e) => imposta('microfono', e.target.value || null)}
          >
            <option value="">{tr('Come il sistema')}{diSistema ? ` · ${diSistema.nome}` : ''}</option>
            {/* i virtuali in fondo: servono solo per l'audio di altre app */}
            {[...microfoni].sort((a, b) => Number(a.virtuale) - Number(b.virtuale)).map((m) => (
              <option key={m.uid} value={m.uid}>{m.nome}{m.virtuale ? ` — ${tr('virtuale')}` : ''}</option>
            ))}
          </select>
          <Icona nome="giu" dimensione={12} className={s.freccia} />
        </span>
      </Riga>
      <Riga
        titolo={tr('Correzioni in diretta')}
        spiega={tr('Mentre registri, un pallino a margine quando una data, un numero o un nome non torna con quello che ha detto il professore.')}
      >
        <Interruttore etichetta={tr('Correzioni in diretta')} acceso={impostazioni.correzioniInDiretta} onCambia={(v) => imposta('correzioniInDiretta', v)} />
      </Riga>
      <Riga titolo={tr('Tieni anche l’audio')} spiega={tr('Circa 17 MB per ogni ora di lezione. Senza, resta solo la trascrizione.')}>
        <Interruttore etichetta={tr('Tieni anche l’audio')} acceso={impostazioni.salvaAudio} onCambia={(v) => imposta('salvaAudio', v)} />
      </Riga>
      <Riga titolo={tr('Scorciatoia per registrare')}>
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
        titolo={tr('Cerca anche sul web')}
        spiega={web
          ? tr('Oltre a Wikimedia Commons, immagini libere dal web, con la licenza su ognuna.')
          : tr('Le immagini arrivano solo da Wikimedia Commons, con la licenza su ognuna.')}
      >
        <Interruttore etichetta={tr('Cerca anche sul web')} acceso={web} onCambia={(v) => imposta('fonteImmagini', v ? 'web' : 'commons')} />
      </Riga>
      <Riga titolo={tr('Cerca mentre scrivi')} spiega={<>Scrivi <code>!Basilica di Superga!</code> negli appunti e la ricerca parte da sola, nel pannello Immagini.</>}>
        <Interruttore etichetta={tr('Cerca mentre scrivi')} acceso={impostazioni.sintassiImmagini} onCambia={(v) => imposta('sintassiImmagini', v)} />
      </Riga>
    </>
  )
}

/*  Quelle che NON si cambiano: non sono scorciatoie, sono sintassi —
 *  e i tasti della revisione, dove una lettera riassegnata male
 *  vorrebbe dire non riuscire più a scrivere. */
const FISSE: [string, string][] = [
  ['/', tr('Menu dei blocchi, in una riga vuota')],
  ['$$…$$', tr('Formula nel testo')],
  ['!…!', tr('Cerca un’immagine')],
  ['⌥⌘↓  ⌥⌘↑', tr('Segnalazione dopo, e prima')],
  ['J  K', tr('Proposta dopo, e prima (in revisione)')],
  ['↵  X', tr('Accetta, rifiuta (in revisione)')],
  ['esc', tr('Chiude menu e finestre')],
]

/*  Le scorciatoie si registrano premendole: il campo ascolta il tasto
 *  vero invece di far scrivere «⌘⇧B» a mano. Esc lascia com'era,
 *  ⌫ rimette quella di serie, e una combinazione già presa non si
 *  prende: se la si potesse rubare, il comando derubato resterebbe
 *  senza tasto e nessuno lo direbbe. */
function Tastiera({ stretta }: { stretta: boolean }) {
  useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [inAscolto, setInAscolto] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [mostraFisse, setMostraFisse] = useState(!stretta)

  useEffect(() => {
    if (!inAscolto) return
    const giu = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setInAscolto(null); setAvviso(null); return }
      if (e.key === 'Backspace') { impostaScorciatoia(inAscolto, null); setInAscolto(null); setAvviso(null); return }
      const combinazione = combinazioneDa(e)
      if (!combinazione) return   // solo modificatori, o un tasto da solo: si aspetta
      const presa = giaPresa(combinazione, inAscolto)
      if (presa) { setAvviso(tr('{tasti} è già di «{comando}»', { tasti: scrittaDi(combinazione), comando: presa.nome })); return }
      impostaScorciatoia(inAscolto, combinazione)
      setInAscolto(null)
      setAvviso(null)
    }
    window.addEventListener('keydown', giu, true)
    return () => window.removeEventListener('keydown', giu, true)
  }, [inAscolto])

  const cambiate = COMANDI.filter((c) => combinazioneDi(c.id) !== c.predefinita).length

  const gruppo = (ambito: 'app' | 'editor') => (
    <dl className={s.scorciatoie}>
      {COMANDI.filter((c) => c.ambito === ambito).map((c) => (
        <div key={c.id} className={s.scorciatoia}>
          <dt>{c.nome}</dt>
          <dd>
            <button
              className={`${s.tastoCambia} ${inAscolto === c.id ? s.inAscolto : ''}`}
              aria-label={tr('Cambia la scorciatoia di {comando}', { comando: c.nome })}
              onClick={() => { setAvviso(null); setInAscolto(inAscolto === c.id ? null : c.id) }}
            >
              {inAscolto === c.id ? tr('premi i tasti…') : scrittaDi(combinazioneDi(c.id))}
            </button>
          </dd>
        </div>
      ))}
    </dl>
  )

  return (
    <>
      <Riga
        titolo={tr('Le scorciatoie')}
        spiega={inAscolto
          ? <Tr frase="Premi la combinazione. <b>esc</b> lascia com’era, <b>⌫</b> rimette quella di serie." />
          : tr('Clicca una combinazione per cambiarla. Ci vuole almeno ⌘, ⌥ o ⌃: una lettera da sola servirebbe a scrivere.')}
      >
        {cambiate > 0 && (
          <button className={s.secondario} onClick={() => { azzeraScorciatoie(); setInAscolto(null); setAvviso(null) }}>
            {tr('Ripristina tutte')}
          </button>
        )}
      </Riga>
      {avviso && <p className={s.avvisoTasti}>{avviso}</p>}

      <h3 className={s.gruppoTasti}>{tr('Nell’app')}</h3>
      {gruppo('app')}
      <h3 className={s.gruppoTasti}>{tr('Nel foglio')}</h3>
      {gruppo('editor')}

      <Riga titolo={tr('Quelle che non si cambiano')} spiega={tr('Sintassi che scrivi, e i tasti della revisione.')}>
        <button className={s.secondario} aria-expanded={mostraFisse} onClick={() => setMostraFisse((v) => !v)}>
          <Icona nome="tastiera" dimensione={14} />
          {mostraFisse ? tr('Nascondi') : tr('Mostra')}
        </button>
      </Riga>
      {mostraFisse && (
        <dl className={s.scorciatoie}>
          {FISSE.map(([tasti, cosa]) => (
            <div key={tasti} className={s.scorciatoia}>
              <dt>{cosa}</dt>
              <dd>{tasti.split('  ').map((x) => <kbd key={x} className={s.tasto}>{x}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
