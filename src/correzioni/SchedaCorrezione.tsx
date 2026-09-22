import {
  useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent,
} from 'react'
import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { normalizza } from '../lib/testo'
import { chiudiScheda, iscrivitiScheda, leggiScheda } from './statoScheda'
import { mappaCorrezioni } from './deposito'
import { nucleo, pezzi } from './confronto'
import { accettaCorrezione, lasciaCorrezione } from './applica'
import { pallinoDi, segnalazioni, vaiAllaSegnalazione } from './naviga'
import type { Correzione } from './tipi'
import { useLargo } from '../layout/larghezza'
import { Icona } from '../lib/Icona'
import s from './SchedaCorrezione.module.css'

/*  La scheda che si apre dal pallino a margine (o con ⌥⌘↓ e ⌥⌘↑): cosa
 *  ha detto il professore, cosa cambierebbe, e la scelta. Una
 *  segnalazione per volta, col conto di quante ce ne sono nella pagina.
 *  ↵ corregge, X lascia così, Esc chiude lasciandola lì per dopo; in
 *  tutti e tre i casi il cursore torna nel testo dov'era.
 *
 *  Dove sta: sotto la riga, allineata a destra (372 px). Da 1200 px in
 *  su, nel margine a destra della colonna (300 px), accanto alla riga,
 *  così non copre il testo — se lì c'è posto; se no, sotto la riga. */

const STRETTA = 372
const NEL_MARGINE = 300
const STACCO = 8
const BORDO = 12

export function SchedaCorrezione({ editor, doc }: { editor: Editor; doc: Y.Doc }) {
  const aperta = useSyncExternalStore(iscrivitiScheda, leggiScheda)
  // cambiando pagina la scheda di un'altra pagina non resta aperta
  useEffect(() => chiudiScheda, [doc])
  if (!aperta) return null
  return <Scheda key={aperta.id} editor={editor} doc={doc} id={aperta.id} />
}

function quandoFa(ms: number) {
  const minuti = Math.round((Date.now() - ms) / 60_000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return `${minuti} min fa`
  const d = new Date(ms)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return new Date().toDateString() === d.toDateString() ? `alle ${ora}` : `il ${d.toLocaleDateString('it-IT')} alle ${ora}`
}

/** La citazione, con in evidenza le parole che servono alla correzione. */
function Citazione({ c }: { c: Correzione }) {
  const nuove = new Set(pezzi(normalizza(nucleo(c.prima, c.dopo).sostituto)).filter((p) => p.trim()))
  return (
    <p className={s.citazione}>
      «{pezzi(c.detto).map((p, i) => (nuove.has(normalizza(p)) ? <b key={i}>{p}</b> : p))}»
    </p>
  )
}

function Cambio({ c }: { c: Correzione }) {
  const { da, a, sostituto } = nucleo(c.prima, c.dopo)
  // un'aggiunta pura si capisce solo vedendo tutto il pezzo
  const [vecchio, nuovo] = a > da ? [c.prima.slice(da, a), sostituto.trim()] : [c.prima, c.dopo]
  return (
    <div className={s.cambio}>
      <span className={s.vecchio}>{vecchio}</span>
      <Icona nome="destra" dimensione={14} className={s.freccia} />
      <span className={s.nuovo}>{nuovo}</span>
    </div>
  )
}

function Scheda({ editor, doc, id }: { editor: Editor; doc: Y.Doc; id: string }) {
  const [, ridisegna] = useReducer((n: number) => n + 1, 0)
  const [dove, setDove] = useState<CSSProperties | null>(null)
  const rif = useRef<HTMLDivElement>(null)
  const correggi = useRef<HTMLButtonElement>(null)
  const largo = useLargo()

  // le correzioni cambiano mentre la scheda è aperta: una nuova che
  // arriva, un pezzo che riscrivi
  useEffect(() => {
    const mappa = mappaCorrezioni(doc)
    mappa.observe(ridisegna)
    editor.on('update', ridisegna)
    return () => { mappa.unobserve(ridisegna); editor.off('update', ridisegna) }
  }, [doc, editor])

  const tutte = segnalazioni(editor, doc)
  const i = tutte.findIndex((x) => x.c.id === id)
  const c = i >= 0 ? tutte[i].c : null

  // agganciata alla riga del pallino, anche mentre la pagina scorre
  const posiziona = useCallback(() => {
    const pallino = pallinoDi(editor, id)
    const tela = pallino?.closest<HTMLElement>('[data-scorre]')
    const scheda = rif.current
    if (!pallino || !tela || !scheda) return
    const riga = pallino.getBoundingClientRect()
    const vista = tela.getBoundingClientRect()

    if (largo && riga.right + STACCO + NEL_MARGINE <= vista.right - BORDO) {
      const top = Math.min(riga.top - STACCO, window.innerHeight - BORDO - scheda.offsetHeight)
      setDove({ left: riga.right + STACCO, top: Math.max(vista.top + BORDO, top), width: NEL_MARGINE })
      return
    }
    const larga = Math.min(STRETTA, vista.width - 2 * BORDO)
    const right = window.innerWidth - vista.right + BORDO
    setDove(riga.bottom + STACCO + scheda.offsetHeight > window.innerHeight - BORDO
      ? { right, bottom: window.innerHeight - riga.top + STACCO, width: larga }
      : { right, top: riga.bottom + STACCO, width: larga })
  }, [editor, id, largo])

  useLayoutEffect(() => {
    posiziona()
    // anche quando cambia lei: più stretta nel margine, è più alta
    const misura = new ResizeObserver(posiziona)
    if (rif.current) misura.observe(rif.current)
    window.addEventListener('scroll', posiziona, true)
    window.addEventListener('resize', posiziona)
    return () => {
      misura.disconnect()
      window.removeEventListener('scroll', posiziona, true)
      window.removeEventListener('resize', posiziona)
    }
  }, [posiziona])

  // appena al suo posto, il fuoco su «Correggi»: ↵ corregge
  const pronta = dove !== null
  useEffect(() => { if (pronta) correggi.current?.focus() }, [pronta])

  const chiudi = useCallback(() => {
    chiudiScheda()
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [editor])

  // risolta altrove, o il pezzo non c'è più
  useEffect(() => { if (!c) chiudi() }, [c, chiudi])
  if (!c) return null

  const lascia = () => { lasciaCorrezione(doc, c); chiudi() }
  const tasti = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); chiudi() }
    else if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); lascia() }
    else if (e.metaKey && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      vaiAllaSegnalazione(editor, doc, e.key === 'ArrowDown' ? 1 : -1)
    }
  }

  return (
    <div className={s.velo} onMouseDown={chiudi}>
      <div
        ref={rif}
        className={s.scheda}
        style={dove ?? { visibility: 'hidden', width: STRETTA }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={tasti}
        role="dialog"
        aria-label="Correzione dalla lezione"
      >
        <div className={s.testa}>
          <span className={s.etichetta}>Il professore ha detto · {quandoFa(c.quando)}</span>
          {tutte.length > 1 && <span className={s.contatore}>{i + 1} di {tutte.length}</span>}
        </div>
        <Citazione c={c} />
        <Cambio c={c} />
        <div className={s.piede}>
          {tutte.length > 1 && (
            <span className={s.suggerimento}><kbd className={s.tasto}>⌥⌘↓</kbd> prossima</span>
          )}
          <span className={s.azioni}>
            <button className={`${s.pulsante} ${s.lascia}`} onClick={lascia}>
              Lascia così <kbd className={s.tasto}>X</kbd>
            </button>
            <button ref={correggi} className={`${s.pulsante} ${s.correggi}`} onClick={() => { accettaCorrezione(editor, doc, c); chiudi() }}>
              Correggi <kbd className={s.tasto}>↵</kbd>
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
