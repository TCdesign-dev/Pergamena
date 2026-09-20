import type { ReactNode } from 'react'
import s from './Guscio.module.css'

/*  Tre zone. La terza — il pannello delle immagini e dell'AI —
 *  arriva in fase 2: il posto è già qui perché aggiungerla non
 *  debba rimescolare il layout. */
export function Guscio({
  lato,
  centro,
  destra,
  latoAperto,
}: {
  lato: ReactNode
  centro: ReactNode
  destra?: ReactNode
  latoAperto: boolean
}) {
  return (
    <div className={`${s.guscio} ${latoAperto ? '' : s.latoChiuso} ${destra ? s.conDestra : ''}`}>
      <aside className={s.lato}>{lato}</aside>
      <main className={s.centro}>{centro}</main>
      {destra && <aside className={s.destra}>{destra}</aside>}
    </div>
  )
}
