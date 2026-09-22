import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { normalizza } from '../lib/testo'
import { chiudiScheda, iscrivitiScheda, leggiScheda, type SchedaAperta } from './statoScheda'
import { inAttesa, mappaCorrezioni } from './deposito'
import { trovaCorrezione } from './posto'
import { nucleo, pezzi } from './confronto'
import { accettaCorrezione, lasciaCorrezione } from './applica'
import type { Correzione } from './tipi'
import s from './SchedaCorrezione.module.css'

/*  La scheda che si apre dal pallino a margine: cosa ha detto il
 *  professore, cosa cambierebbe, e la scelta. Invio corregge, Esc chiude
 *  lasciando la correzione lì per dopo; «Lascia così» la toglie. */

const LARGHEZZA = 300

export function SchedaCorrezione({ editor, doc }: { editor: Editor; doc: Y.Doc }) {
  const aperta = useSyncExternalStore(iscrivitiScheda, leggiScheda)
  // cambiando pagina la scheda di un'altra pagina non resta aperta
  useEffect(() => chiudiScheda, [doc])
  if (!aperta) return null
  return <Scheda key={aperta.blocco} editor={editor} doc={doc} aperta={aperta} />
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
    <blockquote className={s.citazione}>
      «{pezzi(c.detto).map((p, i) => (nuove.has(normalizza(p)) ? <b key={i}>{p}</b> : p))}»
    </blockquote>
  )
}

function Cambio({ c }: { c: Correzione }) {
  const { da, a, sostituto } = nucleo(c.prima, c.dopo)
  // un'aggiunta pura si capisce solo vedendo tutto il pezzo
  const [vecchio, nuovo] = a > da ? [c.prima.slice(da, a), sostituto.trim()] : [c.prima, c.dopo]
  return (
    <div className={s.cambio}>
      <span className={s.vecchio}>{vecchio}</span>
      <span className={s.freccia} aria-hidden>→</span>
      <span className={s.nuovo}>{nuovo}</span>
    </div>
  )
}

function Scheda({ editor, doc, aperta }: { editor: Editor; doc: Y.Doc; aperta: SchedaAperta }) {
  const [, ridisegna] = useReducer((n: number) => n + 1, 0)
  const [dove, setDove] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const primo = useRef<HTMLButtonElement>(null)

  // le correzioni cambiano mentre la scheda è aperta: una nuova che
  // arriva, un pezzo che riscrivi
  useEffect(() => {
    const mappa = mappaCorrezioni(doc)
    mappa.observe(ridisegna)
    editor.on('update', ridisegna)
    return () => { mappa.unobserve(ridisegna); editor.off('update', ridisegna) }
  }, [doc, editor])

  const visibili = inAttesa(doc, aperta.blocco).filter((c) => trovaCorrezione(editor.state.doc, c))

  // sotto al pallino, allineata al suo bordo destro; sopra, se sotto non c'è posto
  useLayoutEffect(() => {
    const left = Math.max(12, Math.min(aperta.destra - LARGHEZZA + 6, window.innerWidth - LARGHEZZA - 12))
    setDove(aperta.sotto + 220 > window.innerHeight
      ? { left, bottom: window.innerHeight - aperta.sopra + 6 }
      : { left, top: aperta.sotto + 6 })
  }, [aperta])

  useEffect(() => { primo.current?.focus() }, [dove])

  const chiudi = () => {
    chiudiScheda()
    editor.commands.focus(undefined, { scrollIntoView: false })
  }

  useEffect(() => {
    if (!visibili.length) chiudi()
  })

  if (!dove || !visibili.length) return null
  return (
    <div className={s.velo} onMouseDown={chiudi}>
      <div
        className={s.scheda}
        style={{ ...dove, width: LARGHEZZA }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); chiudi() } }}
        role="dialog"
        aria-label="Scheda della correzione"
      >
        {visibili.map((c, i) => (
          <div key={c.id} className={s.voce}>
            <div className={s.etichetta}>Il professore ha detto · {quandoFa(c.quando)}</div>
            <Citazione c={c} />
            <Cambio c={c} />
            <div className={s.azioni}>
              <button className={s.lascia} onClick={() => lasciaCorrezione(doc, c)}>Lascia così</button>
              <button
                ref={i === 0 ? primo : undefined}
                className={s.correggi}
                onClick={() => accettaCorrezione(editor, doc, c)}
              >
                Correggi <kbd>↵</kbd>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
