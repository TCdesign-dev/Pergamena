import { useSyncExternalStore } from 'react'
import { iscrivitiRegistrazione, leggiRegistrazione } from './statoRegistrazione'
import s from './InCorso.module.css'
import { tr } from '../lingua/lingua'

/*  «Si sta registrando», fuori dalla pagina che registra.
 *
 *  Dentro alla pagina lo dice il pulsante rosso in alto; ma dalle
 *  Materie, o mentre guardi un'altra pagina, non lo diceva nessuno —
 *  e una lezione registrata per sbaglio sulla pagina sbagliata la
 *  scopri solo dopo. Il pallino rosso sta accanto alla pagina che sta
 *  registrando, ovunque quella pagina sia nominata. */

/** L'id della pagina su cui si sta registrando adesso, se c'è. */
export function usePaginaRegistrata(): string | null {
  const stato = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  if (stato.attiva) return stato.documentoId
  // una registrazione che il server fa ma che scrive un'altra finestra
  return stato.altrove?.documentoId ?? null
}

/** Il pallino rosso: c'è solo sulla pagina che sta registrando. */
export function PallinoInCorso({ documentoId }: { documentoId: string }) {
  const registrata = usePaginaRegistrata()
  if (registrata !== documentoId) return null
  return <span className={s.pallino} role="img" title={tr('Si sta registrando qui')} aria-label={tr('Si sta registrando qui')} />
}

/** La pastiglia in cima alle Materie: dice dove, e ci porta. */
export function AvvisoInCorso({ titolo, onVai }: { titolo: string; onVai: () => void }) {
  return (
    <button className={s.avviso} onClick={onVai} title={tr('Vai alla pagina che sta registrando')}>
      <span className={s.pallino} />
      Si sta registrando · {titolo || tr('Senza titolo')}
    </button>
  )
}
