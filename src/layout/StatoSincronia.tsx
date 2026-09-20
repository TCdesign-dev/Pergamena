import { useSyncExternalStore } from 'react'
import { iscrivitiSync, leggiSync, erroreSync } from '../sync/statoSync'
import { iscrivitiAccesso, leggiAccesso, esci } from '../sync/accesso'
import { configurato } from '../sync/cliente'
import s from './StatoSincronia.module.css'

const PAROLE: Record<string, string> = {
  spento: 'solo su questo Mac',
  collego: 'mi collego…',
  allineato: 'al sicuro',
  invio: 'salvo…',
  offline: 'offline',
}

export function StatoSincronia({ onAccedi }: { onAccedi: () => void }) {
  const sync = useSyncExternalStore(iscrivitiSync, leggiSync)
  const { pronto, utente } = useSyncExternalStore(iscrivitiAccesso, leggiAccesso)

  if (!configurato || !pronto) return null

  if (!utente) {
    return (
      <button className={s.riga} onClick={onAccedi} title="Copia gli appunti al sicuro e leggili dal telefono">
        <span className={`${s.spia} ${s.spento}`} />
        <span className={s.parola}>solo su questo Mac</span>
        <span className={s.azione}>accedi</span>
      </button>
    )
  }

  return (
    <button
      className={s.riga}
      title={`${utente.email}${erroreSync() ? `\n${erroreSync()}` : ''}\n\nClicca per uscire`}
      onClick={() => { if (confirm('Uscire? Gli appunti restano su questo Mac.')) void esci() }}
    >
      <span className={`${s.spia} ${s[sync]}`} />
      <span className={s.parola}>{PAROLE[sync] ?? sync}</span>
    </button>
  )
}
