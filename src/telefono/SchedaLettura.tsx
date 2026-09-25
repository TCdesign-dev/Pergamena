import type { Quaderno } from '../documento/tipi'
import { comeDetto, dataBreve, inOrdine, mancano } from '../lib/esami'
import { indirizzo } from '../materia/Collegamenti'
import s from './Telefono.module.css'
import { tr } from '../lingua/lingua'

/** I campi della scheda, in sola lettura: solo quelli compilati. */
export function SchedaLettura({ quaderno }: { quaderno: Quaderno }) {
  const esami = inOrdine(quaderno.esami).filter((e) => e.nome || e.data)
  const link = (quaderno.collegamenti ?? []).filter((c) => c.url.trim())
  const vuota = !esami.length && !quaderno.docente && !quaderno.email && !quaderno.ricevimento && !link.length

  if (vuota) return null

  return (
    <dl className={s.campiScheda}>
      {esami.length > 0 && (
        <>
          <dt>{tr('Esami')}</dt>
          <dd>
            {esami.map((e) => {
              const n = e.data ? mancano(e.data) : null
              return (
                <p key={e.id} className={n !== null && n < 0 ? s.passato : undefined}>
                  <b>{e.nome || tr('Esame')}</b>
                  {e.data && <> · {dataBreve(e.data)} · <span className={n !== null && n >= 0 && n <= 14 ? s.vicino : undefined}>{comeDetto(e.data)}</span></>}
                  {e.nota && <span className={s.notaEsame}> — {e.nota}</span>}
                </p>
              )
            })}
          </dd>
        </>
      )}
      {quaderno.docente && (<><dt>{tr('Docente')}</dt><dd>{quaderno.docente}</dd></>)}
      {quaderno.email && (<><dt>{tr('Email')}</dt><dd><a href={`mailto:${quaderno.email}`}>{quaderno.email}</a></dd></>)}
      {quaderno.ricevimento && (<><dt>{tr('Ricevimento')}</dt><dd>{quaderno.ricevimento}</dd></>)}
      {link.length > 0 && (
        <>
          <dt>{tr('Link')}</dt>
          <dd>{link.map((c) => <p key={c.id}><a href={indirizzo(c.url)} target="_blank" rel="noreferrer">{c.titolo || c.url}</a></p>)}</dd>
        </>
      )}
    </dl>
  )
}
