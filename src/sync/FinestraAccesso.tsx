import { useState } from 'react'
import { entraConPassword, inviaCodice, verificaCodice } from './accesso'
import s from './FinestraAccesso.module.css'
import { tr } from '../lingua/lingua'

/*  La password è la strada principale: nessuna mail, nessun limite di
 *  invio, nessuna attesa. L'utente si crea una volta sola dal pannello
 *  di Supabase con «Auto Confirm User» spuntato.
 *
 *  La posta resta come seconda strada per quando non ricordi la
 *  password, o per entrare al volo da un dispositivo nuovo. */

type Passo = 'password' | 'email' | 'codice'

export function FinestraAccesso({ onChiudi }: { onChiudi: () => void }) {
  const [passo, setPasso] = useState<Passo>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codice, setCodice] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')

  async function prosegui(e: React.FormEvent) {
    e.preventDefault()
    setErrore('')
    setInCorso(true)
    try {
      if (passo === 'password') {
        await entraConPassword(email, password)
        onChiudi()
      } else if (passo === 'email') {
        await inviaCodice(email)
        setPasso('codice')
      } else {
        await verificaCodice(email, codice)
        onChiudi()
      }
    } catch (err) {
      setErrore(traduci(err instanceof Error ? err.message : tr('qualcosa è andato storto')))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className={s.velo} onMouseDown={onChiudi}>
      <form className={s.pannello} onMouseDown={(e) => e.stopPropagation()} onSubmit={prosegui}>
        <h2 className={s.titolo}>
          {passo === 'codice' ? tr('Controlla la posta') : tr('Sincronizza gli appunti')}
        </h2>

        <p className={s.spiega}>
          {passo === 'password' &&
            tr('Gli appunti restano su questo Mac. L’accesso serve a copiarli al sicuro e a leggerli dal telefono.')}
          {passo === 'email' &&
            tr('Ti mandiamo un link (o un codice) per entrare senza password.')}
          {passo === 'codice' &&
            tr('Abbiamo scritto a {email}. Clicca il link nel messaggio — torni qui già dentro. Se invece ti è arrivato un codice, scrivilo qui sotto.', { email })}
        </p>

        {passo !== 'codice' && (
          <input
            className={s.campo}
            type="email"
            autoFocus
            required
            autoComplete="username"
            value={email}
            placeholder={tr('tu@esempio.it')}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {passo === 'password' && (
          <input
            className={`${s.campo} ${s.sotto}`}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            placeholder={tr('password')}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {passo === 'codice' && (
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
          {passo === 'password' && (
            <button type="button" className={s.secondario} onClick={() => setPasso('email')}>
              entra via email
            </button>
          )}
          {passo !== 'password' && (
            <button type="button" className={s.secondario} onClick={() => setPasso('password')}>
              usa la password
            </button>
          )}
          <button type="submit" className={s.principale} disabled={inCorso}>
            {inCorso ? '…' : passo === 'email' ? tr('Mandami il link') : tr('Entra')}
          </button>
        </div>
      </form>
    </div>
  )
}

/** I messaggi di Supabase sono in inglese e poco chiari sul da farsi. */
function traduci(messaggio: string) {
  const m = messaggio.toLowerCase()
  if (m.includes('rate limit') || m.includes('after') && m.includes('seconds')) {
    return tr('Troppe email richieste. Usa la password: si crea in un minuto dal pannello di Supabase, in Authentication › Users.')
  }
  if (m.includes('invalid login credentials')) {
    return tr('Email o password sbagliate. Se non hai ancora una password, creala dal pannello di Supabase in Authentication › Users.')
  }
  if (m.includes('email not confirmed')) {
    return tr('Utente non confermato. Nel pannello di Supabase, in Authentication › Users, spunta «Auto Confirm User».')
  }
  if (m.includes('token has expired') || m.includes('invalid')) {
    return tr('Codice scaduto o già usato. Chiedine un altro.')
  }
  return messaggio
}
