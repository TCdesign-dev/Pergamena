import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './MenuPagina.module.css'

/*  Il menu ⋯: le cose che servono di rado — della pagina, nella barra
 *  in alto, o di una lezione, nel pannello Lezioni. Si apre col clic o
 *  da tastiera, si scorre con le frecce, si chiude con Esc, con un clic
 *  fuori o scegliendo una voce. Sta in posizione fissa sotto al suo
 *  pulsante: dentro un pannello che scorre non viene tagliato.
 *
 *  Posizione fissa vuol dire due cose. La prima: il menu NON segue più
 *  il pulsante, quindi se qualcosa scorre resta indietro — da qui il
 *  fuoco che non scrolla e il menu che si chiude se il suo pulsante si
 *  sposta. La seconda: «fisso» vale rispetto alla finestra SOLO se
 *  nessun antenato ha un transform. Ce l'hanno la riga di una lezione
 *  e la copertina di una materia, che entrano con un'animazione e si
 *  tengono la matrice identità: il menu ci si agganciava e finiva 100
 *  px più in basso, o fuori dallo schermo a sinistra. Per questo il
 *  menu si disegna in fondo al documento, fuori da tutto. */

const STACCO = 4      // px fra il pulsante e il menu
const MARGINE = 8     // px minimi dal bordo della finestra

export type VoceMenu = {
  etichetta: string
  icona: NomeIcona
  tasto?: string
  /** toglie qualcosa: in rosso */
  pericolo?: boolean
  /** una linea sopra, a separarla dalle altre */
  staccata?: boolean
  azione: () => void
}

export function MenuPagina({ voci, etichetta = 'Altre azioni' }: {
  voci: VoceMenu[]
  /** per i lettori di schermo e il suggerimento al passaggio */
  etichetta?: string
}) {
  const [dove, setDove] = useState<{ top: number; right: number } | null>(null)
  const aperto = dove !== null
  const rifPulsante = useRef<HTMLButtonElement>(null)
  const rifMenu = useRef<HTMLDivElement>(null)
  /** dov'era il pulsante quando si è aperto: per accorgersi se si sposta */
  const ancora = useRef(0)

  const apri = () => {
    const r = rifPulsante.current?.getBoundingClientRect()
    if (!r) return
    ancora.current = r.bottom
    setDove({ top: r.bottom + STACCO, right: window.innerWidth - r.right })
  }
  const setAperto = (v: boolean) => (v ? apri() : setDove(null))

  /*  Se sotto al pulsante non ci sta, il menu si ribalta sopra; e se
   *  sporge a sinistra lo si tira dentro. Si misura dopo il disegno,
   *  perché prima l'altezza non si sa. */
  useLayoutEffect(() => {
    const menu = rifMenu.current
    const r = rifPulsante.current?.getBoundingClientRect()
    if (!aperto || !menu || !r) return
    const alto = menu.offsetHeight
    const sotto = r.bottom + STACCO
    const top = sotto + alto > window.innerHeight - MARGINE && r.top - alto - STACCO >= MARGINE
      ? r.top - alto - STACCO
      : sotto
    const destra = Math.min(window.innerWidth - r.right, window.innerWidth - menu.offsetWidth - MARGINE)
    if (top !== dove.top || destra !== dove.right) setDove({ top, right: destra })
  }, [aperto, dove])

  useEffect(() => {
    if (!aperto) return
    /*  preventScroll: il menu è dentro al pannello che scorre, e senza
     *  questo il browser scrollava il pannello per «mostrare» la voce
     *  a fuoco — la riga se ne andava 126 px più su e il menu restava
     *  appeso in mezzo al nulla. */
    rifMenu.current?.querySelector('button')?.focus({ preventScroll: true })
    const fuori = (e: MouseEvent) => {
      const dove = e.target as Node
      if (rifMenu.current?.contains(dove) || rifPulsante.current?.contains(dove)) return
      setAperto(false)
    }
    /*  Se il pulsante si sposta — qualcuno ha scorso il pannello — il
     *  menu non è più dove deve stare: si chiude. Uno scorrimento che
     *  non lo muove (un'altra parte dell'app) non lo riguarda. */
    const scappa = () => {
      const r = rifPulsante.current?.getBoundingClientRect()
      if (!r || Math.abs(r.bottom - ancora.current) > 2) setDove(null)
    }
    const chiudiSubito = () => setDove(null)
    window.addEventListener('mousedown', fuori)
    window.addEventListener('scroll', scappa, true)
    window.addEventListener('resize', chiudiSubito)
    return () => {
      window.removeEventListener('mousedown', fuori)
      window.removeEventListener('scroll', scappa, true)
      window.removeEventListener('resize', chiudiSubito)
    }
  }, [aperto])

  function chiudi() {
    setAperto(false)
    rifPulsante.current?.focus()
  }

  function tasti(e: KeyboardEvent) {
    const tutte = [...(rifMenu.current?.querySelectorAll('button') ?? [])]
    const i = tutte.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); chiudi() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); tutte[(i + 1) % tutte.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); tutte[(i - 1 + tutte.length) % tutte.length]?.focus() }
    else if (e.key === 'Tab') setAperto(false)
  }

  return (
    <div className={s.menuPagina}>
      <button
        ref={rifPulsante}
        className={`${s.pulsante} ${aperto ? s.attivo : ''}`}
        title={etichetta}
        aria-label={etichetta}
        aria-haspopup="menu"
        aria-expanded={aperto}
        onClick={() => setAperto(!aperto)}
      >
        <Icona nome="altro" />
      </button>

      {aperto && createPortal(
        <div ref={rifMenu} className={s.menu} style={dove} role="menu" aria-label={etichetta} onKeyDown={tasti}>
          {voci.map((v) => (
            <Fragment key={v.etichetta}>
              {v.staccata && <div className={s.linea} role="separator" />}
              <button
                role="menuitem"
                className={`${s.voce} ${v.pericolo ? s.pericolo : ''}`}
                onClick={() => { chiudi(); v.azione() }}
              >
                <Icona nome={v.icona} dimensione={14} />
                <span className={s.etichetta}>{v.etichetta}</span>
                {v.tasto && <kbd className={s.tasto}>{v.tasto}</kbd>}
              </button>
            </Fragment>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
