import { useEffect, useRef, type ReactNode } from 'react'
import s from './Guscio.module.css'

/*  Tre zone: a sinistra la barra laterale, al centro il foglio, a destra
 *  il pannello delle immagini quando è aperto.
 *
 *  La barra laterale ha due forme: intera (248 px) oppure rotaia (48 px,
 *  una colonna di icone). Da stretti c'è sempre la rotaia, e la barra
 *  intera si apre SOPRA il foglio, con un'ombra: non sposta il testo, e
 *  si chiude con Esc, con un clic fuori o scegliendo dove andare. */

export function Guscio({ lato, rotaia, centro, destra, modo, sopra, onChiudiSopra }: {
  /** la barra laterale intera */
  lato: ReactNode
  /** la colonna di icone */
  rotaia: ReactNode
  centro: ReactNode
  destra?: ReactNode
  /** quale forma prende la barra al suo posto */
  modo: 'lato' | 'rotaia'
  /** la barra intera aperta sopra il foglio (solo con la rotaia) */
  sopra: boolean
  onChiudiSopra: () => void
}) {
  const rifSopra = useRef<HTMLElement>(null)
  const aperta = sopra && modo === 'rotaia'

  // sopra il foglio: il fuoco va nella barra, e Esc la chiude
  // riportandolo dov'era (di solito, nel testo)
  useEffect(() => {
    if (!aperta) return
    const prima = document.activeElement as HTMLElement | null
    rifSopra.current?.querySelector('button')?.focus()
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onChiudiSopra()
    }
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('keydown', esc)
      if (prima?.isConnected) prima.focus()
    }
  }, [aperta, onChiudiSopra])

  return (
    <div className={`${s.guscio} ${modo === 'rotaia' ? s.conRotaia : ''} ${destra ? s.conDestra : ''}`}>
      <aside className={s.lato}>{modo === 'lato' ? lato : rotaia}</aside>
      <main className={s.centro}>{centro}</main>
      {destra && <aside className={s.destra}>{destra}</aside>}
      {aperta && (
        <>
          <div className={s.velo} onMouseDown={onChiudiSopra} />
          <aside ref={rifSopra} className={s.sopra}>{lato}</aside>
        </>
      )}
    </div>
  )
}
