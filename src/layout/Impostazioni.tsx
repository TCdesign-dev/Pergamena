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
  { id: 'integratore', nome: 'Integratore', icona: 'ai' },
  { id: 'chiavi', nome: 'Chiavi', icona: 'chiave' },
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
    case 'integratore': return <Integratore />
    case 'chiavi': return <Chiavi />
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
        titolo="Le istruzioni per l’integratore"
        spiega={<>Sono la prima cosa che il modello legge, prima dei tuoi appunti e della trascrizione. <code>{'{massimo}'}</code> diventa il numero massimo di proposte: 8 per una lezione, 16 per tutte insieme.</>}
      />
      <textarea
        className={s.prompt}
        value={bozza}
        spellCheck={false}
        onChange={(e) => setBozza(e.target.value)}
        onBlur={salva}
        aria-label="Le istruzioni per l’integratore"
      />
      <div className={s.sottoPrompt}>
        <span className={s.nota}>
          {suo ? 'Stai usando istruzioni tue.' : 'Stai usando le istruzioni di serie.'}
          {' '}Dopo, il programma aggiunge sempre titoli, immagini e formato della risposta.
        </span>
        <span className={s.tastiPrompt}>
          <button className={s.secondario} disabled={diSerie} onClick={() => { setBozza(ISTRUZIONI_DI_SERIE); imposta('promptMerge', null) }}>
            Ripristina
          </button>
          <button className={s.principale} disabled={!cambiato} onClick={salva}>Salva</button>
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
          placeholder={dalFile ? 'c’è già nel .env.local' : 'incolla qui'}
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
      if (!j.ok) setProva(`non va: ${j.errore ?? 'chiave rifiutata'}`)
      else {
        const soldi = typeof j.residuo === 'number' ? `, ${j.residuo.toFixed(2)} $ residui` : ''
        setProva(`la chiave risponde${soldi}`)
      }
    } catch {
      setProva('il server locale non risponde')
    }
    setInProva(false)
  }

  return (
    <>
      <CampoChiave
        nome="openrouter"
        titolo="OpenRouter"
        dalFile={dalFile}
        spiega={<>Serve all’integratore, ai quiz e alle correzioni in diretta. Si prende su <code>openrouter.ai/keys</code>: qualche centesimo al mese ai ritmi di una persona che studia.</>}
      >
        <button className={s.secondario} disabled={inProva || (!dalFile && !chiavi.openrouter)} onClick={() => void provaChiave()}>
          {inProva ? 'Provo…' : 'Prova'}
        </button>
      </CampoChiave>
      {prova && <p className={s.esitoChiave}>{prova}</p>}

      <CampoChiave
        nome="serper"
        titolo="Serper (facoltativa)"
        spiega={<>Dà le immagini di Google al posto di Openverse. Senza, le immagini arrivano lo stesso da Wikipedia e Commons.</>}
      />

      <CampoChiave
        nome="supabaseUrl"
        titolo="Supabase — indirizzo (facoltativo)"
        tipo="text"
        spiega={<>Per sincronizzare Mac e telefono. Finisce per <code>.supabase.co</code>.</>}
      />
      <CampoChiave
        nome="supabaseAnon"
        titolo="Supabase — chiave pubblica"
        spiega={<>Quella con l’etichetta <b>anon public</b>. Non la <b>service_role</b>: quella scavalca ogni regola di accesso e qui non avrebbe dove stare al sicuro.</>}
      />
      <p className={s.esitoChiave}>
        Le chiavi restano su questo computer e vanno solo al server locale. Supabase entra in funzione al prossimo caricamento della pagina.
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

/*  Quelle che NON si cambiano: non sono scorciatoie, sono sintassi —
 *  e i tasti della revisione, dove una lettera riassegnata male
 *  vorrebbe dire non riuscire più a scrivere. */
const FISSE: [string, string][] = [
  ['/', 'Menu dei blocchi, in una riga vuota'],
  ['$$…$$', 'Formula nel testo'],
  ['!…!', 'Cerca un’immagine'],
  ['⌥⌘↓  ⌥⌘↑', 'Segnalazione dopo, e prima'],
  ['J  K', 'Proposta dopo, e prima (in revisione)'],
  ['↵  X', 'Accetta, rifiuta (in revisione)'],
  ['esc', 'Chiude menu e finestre'],
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
      if (presa) { setAvviso(`${scrittaDi(combinazione)} è già di «${presa.nome}»`); return }
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
              aria-label={`Cambia la scorciatoia di ${c.nome}`}
              onClick={() => { setAvviso(null); setInAscolto(inAscolto === c.id ? null : c.id) }}
            >
              {inAscolto === c.id ? 'premi i tasti…' : scrittaDi(combinazioneDi(c.id))}
            </button>
          </dd>
        </div>
      ))}
    </dl>
  )

  return (
    <>
      <Riga
        titolo="Le scorciatoie"
        spiega={inAscolto
          ? <>Premi la combinazione. <b>esc</b> lascia com’era, <b>⌫</b> rimette quella di serie.</>
          : <>Clicca una combinazione per cambiarla. Ci vuole almeno ⌘, ⌥ o ⌃: una lettera da sola servirebbe a scrivere.</>}
      >
        {cambiate > 0 && (
          <button className={s.secondario} onClick={() => { azzeraScorciatoie(); setInAscolto(null); setAvviso(null) }}>
            Ripristina tutte
          </button>
        )}
      </Riga>
      {avviso && <p className={s.avvisoTasti}>{avviso}</p>}

      <h3 className={s.gruppoTasti}>Nell’app</h3>
      {gruppo('app')}
      <h3 className={s.gruppoTasti}>Nel foglio</h3>
      {gruppo('editor')}

      <Riga titolo="Quelle che non si cambiano" spiega="Sintassi che scrivi, e i tasti della revisione.">
        <button className={s.secondario} aria-expanded={mostraFisse} onClick={() => setMostraFisse((v) => !v)}>
          <Icona nome="tastiera" dimensione={14} />
          {mostraFisse ? 'Nascondi' : 'Mostra'}
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
