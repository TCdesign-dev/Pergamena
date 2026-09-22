import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './MenuPagina.module.css'

/*  Il menu ⋯ della barra in alto: le cose della pagina che servono di
 *  rado. Si apre col clic o da tastiera, si scorre con le frecce, si
 *  chiude con Esc, con un clic fuori o scegliendo una voce. */

export type VoceMenu = {
  etichetta: string
  icona: NomeIcona
  tasto?: string
  /** toglie qualcosa: al passaggio diventa rossa */
  pericolo?: boolean
  azione: () => void
}

export function MenuPagina({ voci }: { voci: VoceMenu[] }) {
  const [aperto, setAperto] = useState(false)
  const rifPulsante = useRef<HTMLButtonElement>(null)
  const rifMenu = useRef<HTMLDivElement>(null)

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
        title="Altre azioni"
        aria-label="Altre azioni"
        aria-haspopup="menu"
        aria-expanded={aperto}
        onClick={() => setAperto((v) => !v)}
      >
        <Icona nome="altro" />
      </button>

      {aperto && (
        <div ref={rifMenu} className={s.menu} role="menu" aria-label="Altre azioni" onKeyDown={tasti}>
          {voci.map((v) => (
            <button
              key={v.etichetta}
              role="menuitem"
              className={`${s.voce} ${v.pericolo ? s.pericolo : ''}`}
              onClick={() => { chiudi(); v.azione() }}
            >
              <Icona nome={v.icona} dimensione={14} />
              <span className={s.etichetta}>{v.etichetta}</span>
              {v.tasto && <kbd className={s.tasto}>{v.tasto}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
