import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { chiudiSchedaCommento, iscrivitiSchedaCommento, leggiSchedaCommento, type SchedaCommento as Aperta } from './statoScheda'
import { aggiornaCommento, aggiungiCommento, mappaCommenti, togliCommento, useCommenti } from './deposito'
import { bloccoDi, elementoDi, segnaTratto, testoDi, togliSegno } from './posizione'
import { quandoFa } from '../lib/quando'
import { Icona } from '../lib/Icona'
import s from './SchedaCommento.module.css'

/*  La scheda di un commento: si apre scrivendone uno nuovo sul testo
 *  selezionato (⌘⇧M o «Commenta» nel menu della selezione), oppure
 *  cliccando un pezzo già commentato.
 *
 *  Sta attaccata sotto al pezzo, e lo segue mentre la pagina scorre.
 *  ↵ salva, ⇧↵ va a capo, Esc chiude senza salvare. «Risolvi» toglie
 *  il commento e il segno dal testo: è la fine di un commento, non un
 *  archivio (l'hai scelto tu). */

const LARGA = 320
const STACCO = 8
const BORDO = 12

export function SchedaCommento({ editor, doc }: { editor: Editor; doc: Y.Doc }) {
  const aperta = useSyncExternalStore(iscrivitiSchedaCommento, leggiSchedaCommento)
  // cambiando pagina non resta aperta la scheda di un'altra
  useEffect(() => chiudiSchedaCommento, [doc])
  if (!aperta) return null
  const chiave = aperta.tipo === 'aperto' ? aperta.id : `nuovo-${aperta.da}`
  return <Scheda key={chiave} editor={editor} doc={doc} aperta={aperta} />
}

function Scheda({ editor, doc, aperta }: { editor: Editor; doc: Y.Doc; aperta: Aperta }) {
  const commenti = useCommenti(doc)
  const c = aperta.tipo === 'aperto' ? commenti.find((x) => x.id === aperta.id) ?? null : null

  const [dove, setDove] = useState<CSSProperties | null>(null)
  const [bozza, setBozza] = useState(c?.testo ?? '')
  const [scrivo, setScrivo] = useState(aperta.tipo === 'nuovo')
  const rif = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  /** Il rettangolo a cui sta attaccata: il pezzo segnato, o la selezione. */
  const ancora = useCallback(() => {
    if (aperta.tipo === 'aperto') {
      const el = elementoDi(editor, aperta.id)
      return el ? el.getBoundingClientRect() : null
    }
    const inizio = editor.view.coordsAtPos(aperta.da)
    const fine = editor.view.coordsAtPos(aperta.a)
    return {
      left: Math.min(inizio.left, fine.left),
      top: Math.min(inizio.top, fine.top),
      bottom: Math.max(inizio.bottom, fine.bottom),
    }
  }, [aperta, editor])

  const posiziona = useCallback(() => {
    const r = ancora()
    const scheda = rif.current
    const tela = editor.view.dom.closest<HTMLElement>('[data-scorre]')
    if (!r || !scheda || !tela) return
    const vista = tela.getBoundingClientRect()
    const larga = Math.min(LARGA, vista.width - 2 * BORDO)
    const left = Math.max(vista.left + BORDO, Math.min(r.left, vista.right - BORDO - larga))
    // sotto al pezzo; se sotto non ci sta, sopra
    setDove(r.bottom + STACCO + scheda.offsetHeight <= window.innerHeight - BORDO
      ? { left, top: r.bottom + STACCO, width: larga }
      : { left, bottom: window.innerHeight - r.top + STACCO, width: larga })
  }, [ancora, editor])

  useLayoutEffect(() => {
    posiziona()
    // cresce mentre scrivi: si riposiziona da sola
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

  const pronta = dove !== null
  useEffect(() => {
    if (!pronta) return
    const el = scrivo ? campo.current : null
    if (!el) { rif.current?.focus({ preventScroll: true }); return }
    el.focus({ preventScroll: true })
    // modificando, il cursore va in fondo: si aggiunge, non si prepone
    el.setSelectionRange(el.value.length, el.value.length)
  }, [pronta, scrivo])

  const chiudi = useCallback(() => {
    chiudiSchedaCommento()
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [editor])

  /*  Esc chiude sempre, anche se il fuoco è rimasto altrove: la scheda
   *  si apre anche dal pannello, e lì il fuoco resta sulla voce che hai
   *  cliccato. In cattura, perché sopra la scheda non c'è nient'altro. */
  useEffect(() => {
    const giu = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      chiudi()
    }
    window.addEventListener('keydown', giu, true)
    return () => window.removeEventListener('keydown', giu, true)
  }, [chiudi])

  // risolto da un'altra finestra, o il pezzo non c'è più
  useEffect(() => {
    if (aperta.tipo === 'aperto' && !mappaCommenti(doc).get(aperta.id)) chiudiSchedaCommento()
  }, [aperta, doc, commenti])

  function salva() {
    const testo = bozza.trim()
    if (aperta.tipo === 'nuovo') {
      if (!testo) return chiudi()
      const tratto = { da: aperta.da, a: aperta.a }
      const nuovo = aggiungiCommento(doc, {
        testo,
        citazione: testoDi(editor, tratto),
        blocco: bloccoDi(editor, tratto.da),
      })
      segnaTratto(editor, tratto, nuovo.id)
      // il cursore in fondo al pezzo: la selezione blu se ne va e si
      // vede il segno viola del commento appena messo
      editor.commands.setTextSelection(tratto.a)
      chiudi()
      return
    }
    if (c && testo) aggiornaCommento(doc, c.id, testo)
    setScrivo(false)
  }

  function risolvi() {
    if (!c) return
    togliSegno(editor, c.id)
    togliCommento(doc, c.id)
    chiudi()
  }

  const tasti = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); chiudi() }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salva() }
  }

  const citazione = aperta.tipo === 'nuovo'
    ? testoDi(editor, { da: aperta.da, a: aperta.a })
    : c?.citazione ?? ''

  return createPortal(
    <div className={s.velo} onMouseDown={chiudi}>
      <div
        ref={rif}
        className={s.scheda}
        style={dove ?? { visibility: 'hidden', width: LARGA }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={tasti}
        tabIndex={-1}
        role="dialog"
        aria-label={aperta.tipo === 'nuovo' ? 'Nuovo commento' : 'Commento'}
      >
        <p className={s.citazione}>«{citazione}»</p>

        {scrivo ? (
          <>
            <textarea
              ref={campo}
              className={s.campo}
              rows={2}
              value={bozza}
              placeholder="Scrivi un commento…"
              onChange={(e) => setBozza(e.target.value)}
            />
            <div className={s.piede}>
              <span className={s.suggerimento}><kbd className={s.tasto}>↵</kbd> salva · <kbd className={s.tasto}>⇧↵</kbd> a capo</span>
              <span className={s.azioni}>
                <button className={s.annulla} onClick={chiudi}>Annulla</button>
                <button className={s.principale} onClick={salva} disabled={!bozza.trim()}>
                  {aperta.tipo === 'nuovo' ? 'Commenta' : 'Salva'}
                </button>
              </span>
            </div>
          </>
        ) : c ? (
          <>
            <p className={s.testo}>{c.testo}</p>
            <div className={s.piede}>
              <span className={s.data}>{quandoFa(c.modificato ?? c.quando)}{c.modificato ? ' · modificato' : ''}</span>
              <span className={s.azioni}>
                <button className={s.annulla} onClick={() => { setBozza(c.testo); setScrivo(true) }}>Modifica</button>
                <button className={s.risolvi} onClick={risolvi}>
                  <Icona nome="accetta" dimensione={14} />Risolvi
                </button>
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
