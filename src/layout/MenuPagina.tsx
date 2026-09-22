import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './MenuPagina.module.css'

/*  Il menu ⋯: le cose che servono di rado — della pagina, nella barra
 *  in alto, o di una lezione, nel pannello Lezioni. Si apre col clic o
 *  da tastiera, si scorre con le frecce, si chiude con Esc, con un clic
 *  fuori o scegliendo una voce. Sta in posizione fissa sotto al suo
 *  pulsante: dentro un pannello che scorre non viene tagliato. */

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

  const apri = () => {
    const r = rifPulsante.current?.getBoundingClientRect()
    if (r) setDove({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }
  const setAperto = (v: boolean) => (v ? apri() : setDove(null))

  useEffect(() => {
    if (!aperto) return
    rifMenu.current?.querySelector('button')?.focus()
    const fuori = (e: MouseEvent) => {
      const dove = e.target as Node
      if (rifMenu.current?.contains(dove) || rifPulsante.current?.contains(dove)) return
      setAperto(false)
    }
    window.addEventListener('mousedown', fuori)
    return () => window.removeEventListener('mousedown', fuori)
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

      {aperto && (
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
        </div>
      )}
    </div>
  )
}
