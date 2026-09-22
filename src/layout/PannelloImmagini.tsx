import { useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import {
  iscrivitiPannello, leggiPannello, avviaRicerca, apriPannello, scartaRicerca, scegliScheda,
} from '../immagini/statoPannello'
import { inserisciDaCommons } from '../immagini/inserisci'
import { useConsigli, cambiaStato, scegliFoto, suggerisci, type Consiglio } from '../immagini/consigliate'
import { TIPO_TRASCINAMENTO } from '../editor/estensioni/immagine'
import type { Trovata } from '../immagini/commons'
import type { RifEditore } from '../editor/Editor'
import { leggiImpostazioni, iscrivitiImpostazioni, imposta } from '../impostazioni'
import { NOMI_FONTI } from '../immagini/web'
import { Miniatura } from './Miniatura'
import { Rotella, Tessere } from './Attesa'
import { Icona } from '../lib/Icona'
import s from './PannelloImmagini.module.css'

/*  Due schede, perché sono due cose diverse.
 *
 *  CERCATE — hai chiesto tu, arrivano dodici risultati, scegli tu, e
 *  l'immagine va dove la trascini.
 *
 *  CONSIGLIATE — è l'AI a dire che un concetto merita un'immagine. Il
 *  consiglio è agganciato al passo degli appunti che lo nomina, quindi
 *  sa già dove andare: sotto quel paragrafo, anche se stai scrivendo
 *  altrove. Una foto in evidenza e tre alternative, non una griglia:
 *  la scelta l'AI l'ha già fatta, a te resta confermarla. */

export function PannelloImmagini({ rifEditore, doc, materia }: {
  rifEditore: RifEditore
  doc: Y.Doc
  materia: string
}) {
  const { scheda } = useSyncExternalStore(iscrivitiPannello, leggiPannello)
  const consigli = useConsigli(doc)
  const nuovi = consigli.filter((c) => c.stato === 'nuovo')

  return (
    <div className={s.pannello}>
      <header className={s.testa}>
        <span className={s.titolo}>Immagini</span>
        <button className={s.chiudi} title="Chiudi  ⌘/" aria-label="Chiudi il pannello" onClick={() => apriPannello(false)}><Icona nome="chiudi" /></button>
      </header>

      <div className={s.schede} role="tablist">
        <button role="tab" aria-selected={scheda === 'consigliate'} className={scheda === 'consigliate' ? s.schedaAttiva : undefined} onClick={() => scegliScheda('consigliate')}>
          Consigliate{nuovi.length > 0 && <span className={s.conto}>{nuovi.length}</span>}
        </button>
        <button role="tab" aria-selected={scheda === 'cercate'} className={scheda === 'cercate' ? s.schedaAttiva : undefined} onClick={() => scegliScheda('cercate')}>
          Cercate
        </button>
      </div>

      {scheda === 'consigliate'
        ? <Consigliate consigli={nuovi} doc={doc} rifEditore={rifEditore} materia={materia} />
        : <Cercate rifEditore={rifEditore} />}
    </div>
  )
}

// ── CONSIGLIATE ────────────────────────────────────────────────────

function Consigliate({ consigli, doc, rifEditore, materia }: {
  consigli: Consiglio[]
  doc: Y.Doc
  rifEditore: RifEditore
  materia: string
}) {
  // aperto un consiglio solo: gli altri stanno su una riga
  const [aperto, setAperto] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<string | null>(null)
  const espanso = aperto && consigli.some((c) => c.id === aperto) ? aperto : consigli[0]?.id

  async function chiediConsigli() {
    const editor = rifEditore.current
    if (!editor) return
    setLavoro('leggo gli appunti…')
    try {
      const n = await suggerisci(editor, doc, materia)
      setLavoro(n ? null : 'Nessun concetto ha bisogno di un’immagine.')
    } catch (e) {
      setLavoro(e instanceof Error ? e.message : 'non è andata')
    }
  }

  function posizioneDopo(idBlocco: string) {
    const editor = rifEditore.current
    let dopo: number | undefined
    editor?.state.doc.forEach((n, p) => { if (n.attrs.idBlocco === idBlocco) dopo = p + n.nodeSize })
    return dopo
  }

  function vaiAlPasso(idBlocco: string) {
    const editor = rifEditore.current
    if (!editor) return
    let inizio: number | undefined
    editor.state.doc.forEach((n, p) => { if (n.attrs.idBlocco === idBlocco) inizio = p })
    if (inizio === undefined) return
    const dom = editor.view.nodeDOM(inizio)
    if (dom instanceof HTMLElement) {
      dom.scrollIntoView({ block: 'center', behavior: 'smooth' })
      dom.animate([{ backgroundColor: 'var(--selezione)' }, { backgroundColor: 'transparent' }], { duration: 1400 })
    }
  }

  async function metti(c: Consiglio) {
    const editor = rifEditore.current
    if (!editor || !c.risultati[0]) return
    // sotto al paragrafo che l'ha fatto nascere; se nel frattempo è
    // stato cancellato, al cursore
    await inserisciDaCommons(editor, c.risultati[0], posizioneDopo(c.blocco))
    cambiaStato(doc, c.id, 'inserito')
  }

  return (
    <div className={s.scorrevole}>
      {consigli.length === 0 && (
        <div className={s.vuoto}>
          <p>
            Qui arrivano le immagini che servono ai concetti dei tuoi appunti.
            Dopo una lezione integrata compaiono da sole; per questa pagina puoi chiederle adesso.
          </p>
          <button className={s.suggerisci} onClick={() => void chiediConsigli()} disabled={lavoro === 'leggo gli appunti…'}>
            {lavoro === 'leggo gli appunti…' ? <><Rotella /> Leggo gli appunti…</> : 'Suggerisci immagini'}
          </button>
          {lavoro && lavoro !== 'leggo gli appunti…' && <p className={s.stato}>{lavoro}</p>}
        </div>
      )}

      {consigli.map((c) => c.id === espanso ? (
        <article key={c.id} className={s.consiglio}>
          <h3 className={s.concetto}>{c.concetto}</h3>
          <button className={s.citazione} title="Vai al passo negli appunti" onClick={() => vaiAlPasso(c.blocco)}>
            ↩︎ «{c.citazione}»
          </button>
          <button
            className={s.foto}
            draggable
            title={`${c.risultati[0].autore} · ${c.risultati[0].licenza}\nTrascinala, o usa il pulsante qui sotto`}
            onDragStart={(e) => {
              e.dataTransfer.setData(TIPO_TRASCINAMENTO, JSON.stringify(c.risultati[0]))
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onDragEnd={(e) => { if (e.dataTransfer.dropEffect !== 'none') cambiaStato(doc, c.id, 'inserito') }}
          >
            <Miniatura src={c.risultati[0].miniatura} alt={c.concetto} draggable={false} />
            <span className={s.credito}>{c.risultati[0].licenza}</span>
          </button>
          {c.risultati.length > 1 && (
            <div className={s.alternative}>
              {c.risultati.slice(1, 4).map((t, i) => (
                <button key={t.chiave} title="Usa questa" onClick={() => scegliFoto(doc, c.id, i + 1)}>
                  <Miniatura src={t.miniatura} alt="" loading="lazy" draggable={false} />
                </button>
              ))}
            </div>
          )}
          <div className={s.azioniConsiglio}>
            <button className={s.metti} onClick={() => void metti(c)}>Metti sotto il paragrafo</button>
            <button className={s.nonServe} onClick={() => cambiaStato(doc, c.id, 'scartato')}>Non serve</button>
          </div>
        </article>
      ) : (
        <button key={c.id} className={s.chiuso} onClick={() => setAperto(c.id)}>
          <span className={s.concetto}>{c.concetto}</span>
          <span className={s.citazioneBreve}>↩︎ «{c.citazione}»</span>
        </button>
      ))}

      {consigli.length > 0 && consigli.length < 5 && (
        <button className={s.ancora} onClick={() => void chiediConsigli()} disabled={lavoro === 'leggo gli appunti…'}>
          {lavoro === 'leggo gli appunti…' ? <><Rotella /> Leggo gli appunti…</> : 'Suggerisci altre'}
        </button>
      )}
    </div>
  )
}

// ── CERCATE ────────────────────────────────────────────────────────

function Cercate({ rifEditore }: { rifEditore: RifEditore }) {
  const { ricerche } = useSyncExternalStore(iscrivitiPannello, leggiPannello)
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [query, setQuery] = useState('')

  function inserisci(t: Trovata) {
    const editor = rifEditore.current
    if (editor) void inserisciDaCommons(editor, t)
  }

  return (
    <>
      {/* il web trova quasi tutto; Commons ha licenze pulite e schede d'autore */}
      <div className={s.fonti} role="radiogroup" aria-label="Dove cercare">
        {(['web', 'commons'] as const).map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={impostazioni.fonteImmagini === f}
            className={impostazioni.fonteImmagini === f ? s.fonteScelta : undefined}
            onClick={() => imposta('fonteImmagini', f)}
          >
            {f === 'web' ? 'Web' : 'Commons'}
          </button>
        ))}
      </div>

      <form className={s.cerca} onSubmit={(e) => { e.preventDefault(); void avviaRicerca(query); setQuery('') }}>
        <input
          className={s.campo}
          value={query}
          placeholder={impostazioni.fonteImmagini === 'web' ? 'Cerca immagini sul web…' : 'Cerca su Wikimedia Commons…'}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <label className={s.interruttore}>
        <input
          type="checkbox"
          checked={impostazioni.sintassiImmagini}
          onChange={(e) => imposta('sintassiImmagini', e.target.checked)}
        />
        <span><code>!parola!</code> cerca mentre scrivi</span>
      </label>

      <div className={s.scorrevole}>
        {ricerche.length === 0 && (
          <p className={s.vuoto}>
            Cerca qui sopra, oppure scrivi <code>!Basilica di Superga!</code> negli
            appunti.<br />Poi trascina l'immagine dove ti serve.
          </p>
        )}

        {ricerche.map((r) => (
          <section key={r.id} className={s.gruppo}>
            <div className={s.intestazione}>
              <span className={s.query}>{r.query}</span>
              {r.origine === 'sintassi' && <span className={s.marchio}>dagli appunti</span>}
              {r.fonte && <span className={s.marchio}>{NOMI_FONTI[r.fonte] ?? r.fonte}</span>}
              {/* cercata anche in inglese: là le foto sono catalogate così */}
              {r.tradotta && <span className={s.marchio} title="Commons e Openverse sono catalogati in inglese: la parola è stata tradotta con Wikipedia">→ {r.tradotta}</span>}
              <button className={s.scarta} title="Togli" aria-label="Togli questa ricerca" onClick={() => scartaRicerca(r.id)}><Icona nome="chiudi" dimensione={12} /></button>
            </div>

            {r.stato === 'in-corso' && <div className={s.griglia}><Tessere quante={6} classe={s.tesseraAttesa} /></div>}
            {r.stato === 'errore' && <p className={s.stato}>{r.errore}</p>}
            {r.stato === 'pronta' && r.risultati.length === 0 && <p className={s.stato}>niente su {NOMI_FONTI[r.fonte ?? 'commons'] ?? 'Commons'}</p>}
            {r.fonte === 'openverse' && r.risultati.length > 0 && (
              <p className={s.stato}>Le prime arrivano da Wikipedia, le altre da Openverse. Con una chiave Serper nel .env.local arrivano quelle di Google Immagini.</p>
            )}

            <div className={s.griglia}>
              {r.risultati.map((t) => (
                <button
                  key={t.chiave}
                  className={s.scheda}
                  title={`${t.titolo}\n${t.autore} · ${t.licenza}\n\nTrascina negli appunti, o clicca per inserirla al cursore`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_TRASCINAMENTO, JSON.stringify(t))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => inserisci(t)}
                >
                  <Miniatura src={t.miniatura} alt={t.titolo} loading="lazy" draggable={false} />
                  <span className={s.credito}>{t.licenza}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
