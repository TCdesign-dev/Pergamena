import { useEffect, useState, useSyncExternalStore } from 'react'
import { useIndice } from '../documento/useIndice'
import type { Quaderno, Documento } from '../documento/tipi'
import { ordina } from '../documento/ordinamento'
import { useImmagine } from '../immagini/useImmagine'
import { useRicerca } from '../ricerca/useRicerca'
import { normalizza } from '../lib/testo'
import { iscrivitiAccesso, leggiAccesso } from '../sync/accesso'
import { accendiSincronia } from '../sync/sincronia'
import { allineaTutto } from '../sync/allineaTutto'
import { FinestraAccesso } from '../sync/FinestraAccesso'
import { iscrivitiSync, leggiSync } from '../sync/statoSync'
import { Lettore } from './Lettore'
import s from './Telefono.module.css'

/*  Sul telefono si consulta, non si scrive.
 *
 *  Non è una limitazione tecnica mascherata da scelta: portare un
 *  editor a blocchi sul touch è una settimana di lavoro e di guai con
 *  la selezione e la tastiera, e serve a un caso d'uso che non hai —
 *  gli appunti li prendi sul Mac, a lezione. Qui serve ritrovarli. */

type Dove =
  | { vista: 'materie' }
  | { vista: 'pagine'; quaderno: Quaderno }
  | { vista: 'lettura'; documento: Documento }

export function Telefono() {
  const { quaderni, documenti } = useIndice()
  const accesso = useSyncExternalStore(iscrivitiAccesso, leggiAccesso)
  const sync = useSyncExternalStore(iscrivitiSync, leggiSync)
  const [dove, setDove] = useState<Dove>({ vista: 'materie' })
  const [query, setQuery] = useState('')
  const nelContenuto = useRicerca(query, documenti, quaderni)

  useEffect(() => {
    if (!accesso.utente) return
    accendiSincronia()
    const fra = setTimeout(() => void allineaTutto(documenti.map((d) => d.id)), 2000)
    return () => clearTimeout(fra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accesso.utente, documenti.length])

  if (accesso.pronto && !accesso.utente) {
    return (
      <div className={s.telefono}>
        <div className={s.benvenuto}>
          <h1>Pergamena</h1>
          <p>Entra per vedere gli appunti che hai preso sul Mac.</p>
        </div>
        <FinestraAccesso onChiudi={() => { /* resta finché non entra */ }} />
      </div>
    )
  }

  const q = normalizza(query.trim())
  const perTitolo = q
    ? documenti.filter((d) =>
        normalizza(d.titolo || 'Senza titolo').includes(q) ||
        normalizza(quaderni.find((k) => k.id === d.quadernoId)?.nome ?? '').includes(q),
      )
    : []
  const gia = new Set(perTitolo.map((d) => d.id))
  const inCerca = query.trim().length >= 2

  return (
    <div className={s.telefono}>
      <header className={s.testa}>
        {dove.vista !== 'materie' ? (
          <button
            className={s.indietro}
            onClick={() =>
              setDove(
                dove.vista === 'lettura'
                  ? { vista: 'pagine', quaderno: quaderni.find((k) => k.id === dove.documento.quadernoId)! }
                  : { vista: 'materie' },
              )
            }
          >
            ‹ {dove.vista === 'lettura' ? (quaderni.find((k) => k.id === dove.documento.quadernoId)?.nome || 'Indietro') : 'Materie'}
          </button>
        ) : (
          <span className={s.marchio}>Pergamena</span>
        )}
        <span className={`${s.spia} ${s[sync]}`} title={sync} />
      </header>

      {dove.vista === 'materie' && (
        <>
          <input
            className={s.cerca}
            value={query}
            placeholder="Cerca negli appunti…"
            onChange={(e) => setQuery(e.target.value)}
          />

          {inCerca ? (
            <div className={s.elenco}>
              {[...perTitolo, ...nelContenuto.filter((r) => !gia.has(r.documentoId)).map((r) =>
                documenti.find((d) => d.id === r.documentoId)!).filter(Boolean)].map((d) => (
                <button key={d.id} className={s.voce} onClick={() => setDove({ vista: 'lettura', documento: d })}>
                  <span className={s.voceTitolo}>{d.titolo || 'Senza titolo'}</span>
                  <span className={s.voceMateria}>
                    {quaderni.find((k) => k.id === d.quadernoId)?.nome || 'Senza nome'}
                  </span>
                </button>
              ))}
              {perTitolo.length === 0 && nelContenuto.length === 0 && (
                <p className={s.nulla}>Nessun risultato.</p>
              )}
            </div>
          ) : (
            <div className={s.griglia}>
              {quaderni.map((k) => (
                <SchedaMateria
                  key={k.id}
                  quaderno={k}
                  pagine={documenti.filter((d) => d.quadernoId === k.id).length}
                  onApri={() => setDove({ vista: 'pagine', quaderno: k })}
                />
              ))}
              {quaderni.length === 0 && (
                <p className={s.nulla}>
                  {sync === 'allineato' ? 'Nessuna materia ancora.' : 'Sto scaricando gli appunti…'}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {dove.vista === 'pagine' && (
        <>
          <h1 className={s.titoloMateria}>{dove.quaderno.nome || 'Senza nome'}</h1>
          <div className={s.elenco}>
            {ordina(documenti.filter((d) => d.quadernoId === dove.quaderno.id), 'modifica').map((d) => (
              <button key={d.id} className={s.voce} onClick={() => setDove({ vista: 'lettura', documento: d })}>
                <span className={s.voceTitolo}>{d.titolo || 'Senza titolo'}</span>
                <span className={s.voceMateria}>{quando(d.modificato)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {dove.vista === 'lettura' && <Lettore documento={dove.documento} />}
    </div>
  )
}

function SchedaMateria({ quaderno, pagine, onApri }: { quaderno: Quaderno; pagine: number; onApri: () => void }) {
  const copertina = useImmagine(quaderno.copertinaId)
  return (
    <button className={s.scheda} onClick={onApri}>
      <span className={s.copertina} data-colore={quaderno.colore}>
        {copertina ? <img src={copertina} alt="" /> : <span>{(quaderno.nome || '?').charAt(0).toUpperCase()}</span>}
      </span>
      <span className={s.nomeMateria}>{quaderno.nome || 'Senza nome'}</span>
      <span className={s.contoPagine}>{pagine} {pagine === 1 ? 'pagina' : 'pagine'}</span>
    </button>
  )
}

function quando(t: number) {
  const g = Math.floor((Date.now() - t) / 86400000)
  if (g < 1) return 'oggi'
  if (g === 1) return 'ieri'
  if (g < 7) return `${g} giorni fa`
  return new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
