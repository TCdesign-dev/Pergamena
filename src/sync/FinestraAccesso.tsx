import { useState } from 'react'
import { inviaCodice, verificaCodice } from './accesso'
import s from './FinestraAccesso.module.css'

/*  Due passi: l'indirizzo, poi il codice che arriva per posta.
 *  Nessuna password da ricordare, nessun link da aprire. */

export function FinestraAccesso({ onChiudi }: { onChiudi: () => void }) {
  const [passo, setPasso] = useState<'email' | 'codice'>('email')
  const [email, setEmail] = useState('')
  const [codice, setCodice] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')

  async function prosegui(e: React.FormEvent) {
    e.preventDefault()
    setErrore('')
    setInCorso(true)
    try {
      if (passo === 'email') {
        await inviaCodice(email)
        setPasso('codice')
      } else {
        await verificaCodice(email, codice)
        onChiudi()
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'qualcosa è andato storto')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className={s.velo} onMouseDown={onChiudi}>
      <form className={s.pannello} onMouseDown={(e) => e.stopPropagation()} onSubmit={prosegui}>
        <h2 className={s.titolo}>
          {passo === 'email' ? 'Sincronizza gli appunti' : 'Controlla la posta'}
        </h2>

        <p className={s.spiega}>
          {passo === 'email'
            ? 'Gli appunti restano su questo Mac. L’accesso serve a copiarli al sicuro e a leggerli dal telefono.'
            : `Abbiamo mandato un codice a ${email}. Scrivilo qui sotto.`}
        </p>

        {passo === 'email' ? (
          <input
            className={s.campo}
            type="email"
            autoFocus
            required
            value={email}
            placeholder="tu@esempio.it"
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : (
          <input
            className={`${s.campo} ${s.cifre}`}
            inputMode="numeric"
            autoFocus
            required
            value={codice}
            placeholder="000000"
            maxLength={8}
            onChange={(e) => setCodice(e.target.value)}
          />
        )}

        {errore && <p className={s.errore}>{errore}</p>}

        <div className={s.piede}>
          {passo === 'codice' && (
            <button type="button" className={s.secondario} onClick={() => setPasso('email')}>
              cambia indirizzo
            </button>
          )}
          <button type="submit" className={s.principale} disabled={inCorso}>
            {inCorso ? '…' : passo === 'email' ? 'Mandami il codice' : 'Entra'}
          </button>
        </div>
      </form>
    </div>
  )
}
