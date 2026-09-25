import { useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { Documento, Quaderno } from '../documento/tipi'
import { useRegistrazioni } from '../registrazione/useRegistrazioni'
import { iscrivitiRegistrazione, leggiRegistrazione } from '../registrazione/statoRegistrazione'
import s from './RigaDati.module.css'
import { locale, tr } from '../lingua/lingua'

/*  Sotto il titolo della pagina, i suoi dati in una riga: la materia,
 *  il giorno, e le lezioni — «lezione in corso» mentre si registra.
 *  Sotto, una linea a tutta colonna: è lei che separa la pagina dagli
 *  argomenti. */

export function RigaDati({ documento, doc, quaderno }: {
  documento: Documento
  doc: Y.Doc
  quaderno: Quaderno | null
}) {
  const lezioni = useRegistrazioni(doc)
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  const inCorso = (r.attiva && r.documentoId === documento.id) || r.altrove?.documentoId === documento.id

  const giorno = new Date(documento.creato)
  const data = giorno.toLocaleDateString(locale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(giorno.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })

  const pezzi = [
    quaderno && (
      <span key="materia" className={s.materia}>
        <span className={s.pallino} data-colore={quaderno.colore} />
        {quaderno.nome || tr('Senza nome')}
      </span>
    ),
    <span key="data">{data}</span>,
    inCorso ? <span key="lezioni">{tr('lezione in corso')}</span>
      : lezioni.length ? <span key="lezioni">{tr('{n} lezione registrata | {n} lezioni registrate', { n: lezioni.length })}</span>
      : null,
  ].filter(Boolean)

  return (
    <div className={s.riga}>
      {pezzi.map((p, i) => (
        <span key={i} className={s.pezzo}>
          {i > 0 && <span className={s.punto} aria-hidden>·</span>}
          {p}
        </span>
      ))}
    </div>
  )
}
