import { useState } from 'react'
import { segnaFattoInPagina, useCompitiMateria } from './materia'
import { comeDetto, dataBreve, mancano } from '../lib/esami'
import { vaiA } from '../layout/navigazione'
import { tr } from '../lingua/lingua'
import s from './NellaScheda.module.css'

/*  I compiti di tutta la materia, nella scheda, sotto le date d'esame:
 *  è lì che si guarda la settimana che viene. Nascono nella pagina
 *  della lezione in cui sono stati assegnati, e il nome della pagina
 *  resta accanto — ci si torna con un clic, per rileggere il contesto.
 *
 *  Quelli fatti stanno chiusi in fondo: servono a rispondere «l'avevo
 *  consegnato?», non a occupare la testata. */

export function CompitiMateria({ quadernoId }: { quadernoId: string }) {
  const compiti = useCompitiMateria(quadernoId)
  const [mostraFatti, setMostraFatti] = useState(false)

  const daFare = compiti.filter((c) => !c.fatto)
  const fatti = compiti.filter((c) => c.fatto)
  const mostrati = mostraFatti ? compiti : daFare

  if (!compiti.length) return <span className={s.vuoto}>{tr('Nessuno')}</span>

  return (
    <div className={s.elenco}>
      {mostrati.map((c) => {
        const giorni = c.data ? mancano(c.data) : null
        return (
          <div key={c.id} className={`${s.riga} ${c.fatto ? s.fatto : ''}`}>
            <input
              type="checkbox"
              className={s.spunta}
              checked={!!c.fatto}
              aria-label={tr('Fatto')}
              onChange={(e) => void segnaFattoInPagina(c.documentoId, c.id, e.target.checked)}
            />
            <span className={s.testo}>{c.testo}</span>
            <span className={`${s.quando} ${!c.fatto && giorni !== null && giorni < 0 ? s.scaduto : ''}`}>
              {c.data ? `${dataBreve(c.data)} · ${comeDetto(c.data)}` : tr('senza scadenza')}
            </span>
            <button className={s.pagina} title={tr('Apri la pagina')} onClick={() => vaiA(c.documentoId)}>
              {c.pagina || tr('Senza titolo')}
            </button>
          </div>
        )
      })}

      {fatti.length > 0 && (
        <button className={s.fatti} onClick={() => setMostraFatti(!mostraFatti)}>
          {mostraFatti
            ? tr('Nascondi quelli fatti')
            : tr('{n} fatto | {n} fatti', { n: fatti.length })}
        </button>
      )}
    </div>
  )
}
