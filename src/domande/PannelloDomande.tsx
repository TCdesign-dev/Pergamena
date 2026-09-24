import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import { chiediAllaLezione } from './chiedi'
import { svuotaDomande, togliDomanda, useDomande } from './deposito'
import { useRegistrazioni } from '../registrazione/useRegistrazioni'
import { quandoFa } from '../lib/quando'
import { Rotella } from '../layout/Attesa'
import { Icona } from '../lib/Icona'
import s from './PannelloDomande.module.css'

/*  «Chiedi alla lezione»: le domande su questa pagina, con le risposte,
 *  in fila come una conversazione.
 *
 *  Il modello legge i tuoi appunti e la trascrizione, e niente altro:
 *  quello che ti dice viene da lì. Le domande restano nella pagina —
 *  a gennaio, mentre ripassi, «cosa ho perso mentre scrivevo» del 12
 *  ottobre vale quanto gli appunti. */

const ESEMPI = [
  'Cosa ho perso mentre scrivevo?',
  'Riassumimi la lezione in cinque punti',
  'Su cosa ha insistito il professore?',
]

export function PannelloDomande({ doc, rifEditore, materia, modo, onChiudi }: {
  doc: Y.Doc
  rifEditore: RifEditore
  materia: string
  modo: 'tendina' | 'lato'
  onChiudi: () => void
}) {
  const domande = useDomande(doc)
  const lezioni = useRegistrazioni(doc)
  const [bozza, setBozza] = useState('')
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const fondo = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { campo.current?.focus() }, [])
  useEffect(() => { fondo.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [domande.length, inCorso])

  useEffect(() => {
    const giu = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onChiudi() }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [onChiudi])

  async function chiedi(testo: string) {
    const editor = rifEditore.current
    if (!editor || inCorso) return
    setErrore(null)
    setInCorso(testo)
    setBozza('')
    try {
      await chiediAllaLezione(editor, doc, materia, testo)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'non ha risposto')
      setBozza(testo)
    }
    setInCorso(null)
    campo.current?.focus()
  }

  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void chiedi(bozza.trim()) }
  }

  const frasi = lezioni.reduce((n, r) => n + r.segmenti.length, 0)

  return (
    <div className={s.pannello} data-modo={modo}>
      <header className={s.testa}>
        <span className={s.titolo}>Chiedi alla lezione</span>
        {domande.length > 0 && (
          <button className={s.svuota} title="Cancella tutte le domande" onClick={() => svuotaDomande(doc)}>
            Svuota
          </button>
        )}
        <button className={s.chiudi} title="Chiudi  esc" aria-label="Chiudi il pannello delle domande" onClick={onChiudi}>
          <Icona nome="chiudi" />
        </button>
      </header>

      <div className={s.corpo}>
        {domande.length === 0 && !inCorso && (
          <div className={s.vuoto}>
            <p className={s.spiega}>
              {frasi > 0
                ? <>Legge i tuoi appunti e le <b>{frasi}</b> frasi trascritte di questa pagina, e risponde solo con quello che c’è lì dentro.</>
                : <>Qui non ci sono lezioni registrate: risponderà solo su quello che hai scritto tu.</>}
            </p>
            {ESEMPI.map((e) => (
              <button key={e} className={s.esempio} onClick={() => void chiedi(e)}>{e}</button>
            ))}
          </div>
        )}

        {domande.map((d) => (
          <article key={d.id} className={s.scambio}>
            <div className={s.domanda}>
              <p className={s.testoDomanda}>{d.domanda}</p>
              <button className={s.togli} title="Togli questa domanda" aria-label="Togli questa domanda" onClick={() => togliDomanda(doc, d.id)}>
                <Icona nome="chiudi" dimensione={12} />
              </button>
            </div>
            <p className={s.risposta}>{d.risposta}</p>
            <p className={s.quando}>
              {quandoFa(d.quando)}
              {d.lezioni > 0 && ` · ${d.lezioni} ${d.lezioni === 1 ? 'lezione' : 'lezioni'}`}
            </p>
          </article>
        ))}

        {inCorso && (
          <article className={s.scambio}>
            <div className={s.domanda}><p className={s.testoDomanda}>{inCorso}</p></div>
            <p className={s.attesa}><Rotella /> legge la lezione…</p>
          </article>
        )}

        {errore && <p className={s.errore}>{errore}</p>}
        <div ref={fondo} />
      </div>

      <footer className={s.piede}>
        <textarea
          ref={campo}
          className={s.campo}
          rows={2}
          value={bozza}
          placeholder="Chiedi qualcosa su questa lezione…"
          disabled={!!inCorso}
          onChange={(e) => setBozza(e.target.value)}
          onKeyDown={tasti}
        />
        <button
          className={s.manda}
          disabled={!bozza.trim() || !!inCorso}
          title="Chiedi  ↵"
          aria-label="Chiedi"
          onClick={() => void chiedi(bozza.trim())}
        >
          {inCorso ? <Rotella /> : <Icona nome="invio" dimensione={14} />}
        </button>
      </footer>
    </div>
  )
}
