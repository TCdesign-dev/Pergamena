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
import { SchedaLettura } from './SchedaLettura'
import { soloPagine, schedaEsistente } from '../documento/archivio'
import { prossimoEsame, comeDetto } from '../lib/esami'
import { Miniatura } from '../layout/Miniatura'
import s from './Telefono.module.css'
import { locale, tr } from '../lingua/lingua'

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
  | { vista: 'scheda'; quaderno: Quaderno }

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
          <p>{tr('Entra per vedere gli appunti che hai preso sul Mac.')}</p>
        </div>
        <FinestraAccesso onChiudi={() => { /* resta finché non entra */ }} />
      </div>
    )
  }

  const q = normalizza(query.trim())
  const perTitolo = q
    ? documenti.filter((d) =>
        normalizza(d.titolo || tr('Senza titolo')).includes(q) ||
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
                  : dove.vista === 'scheda'
                    ? { vista: 'pagine', quaderno: dove.quaderno }
                    : { vista: 'materie' },
              )
            }
          >
            ‹ {dove.vista === 'lettura'
              ? (quaderni.find((k) => k.id === dove.documento.quadernoId)?.nome || 'Indietro')
              : dove.vista === 'scheda' ? (dove.quaderno.nome || 'Indietro') : 'Materie'}
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
            placeholder={tr('Cerca negli appunti…')}
            onChange={(e) => setQuery(e.target.value)}
          />

          {inCerca ? (
            <div className={s.elenco}>
              {[...perTitolo, ...nelContenuto.filter((r) => !gia.has(r.documentoId)).map((r) =>
                documenti.find((d) => d.id === r.documentoId)!).filter(Boolean)].map((d) => (
                <button key={d.id} className={s.voce} onClick={() => {
                  const k = quaderni.find((x) => x.id === d.quadernoId)
                  setDove(d.scheda && k ? { vista: 'scheda', quaderno: k } : { vista: 'lettura', documento: d })
                }}>
                  <span className={s.voceTitolo}>{d.titolo || tr('Senza titolo')}</span>
                  <span className={s.voceMateria}>
                    {quaderni.find((k) => k.id === d.quadernoId)?.nome || tr('Senza nome')}
                  </span>
                </button>
              ))}
              {perTitolo.length === 0 && nelContenuto.length === 0 && (
                <p className={s.nulla}>{tr('Nessun risultato.')}</p>
              )}
            </div>
          ) : (
            <div className={s.griglia}>
              {quaderni.map((k) => (
                <SchedaMateria
                  key={k.id}
                  quaderno={k}
                  pagine={documenti.filter((d) => d.quadernoId === k.id && soloPagine(d)).length}
                  onApri={() => setDove({ vista: 'pagine', quaderno: k })}
                />
              ))}
              {quaderni.length === 0 && (
                <p className={s.nulla}>
                  {sync === 'allineato' ? tr('Nessuna materia ancora.') : tr('Sto scaricando gli appunti…')}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {dove.vista === 'pagine' && (
        <>
          <h1 className={s.titoloMateria}>{dove.quaderno.nome || tr('Senza nome')}</h1>
          <div className={s.elenco}>
            <button className={`${s.voce} ${s.voceScheda}`} onClick={() => setDove({ vista: 'scheda', quaderno: dove.quaderno })}>
              <span className={s.voceTitolo}>{tr('Scheda della materia')}</span>
              <span className={s.voceMateria}>
                {(() => { const e = prossimoEsame(dove.quaderno); return e ? `${e.nome || 'esame'} ${comeDetto(e.data)}` : 'esami, docente, programma' })()}
              </span>
            </button>
            {ordina(documenti.filter((d) => d.quadernoId === dove.quaderno.id && soloPagine(d)), 'modifica').map((d) => (
              <button key={d.id} className={s.voce} onClick={() => setDove({ vista: 'lettura', documento: d })}>
                <span className={s.voceTitolo}>{d.titolo || tr('Senza titolo')}</span>
                <span className={s.voceMateria}>{quando(d.modificato)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {dove.vista === 'lettura' && <Lettore documento={dove.documento} />}

      {dove.vista === 'scheda' && (() => {
        // la materia aggiornata, non quella fotografata quando l'hai aperta
        const k = quaderni.find((x) => x.id === dove.quaderno.id) ?? dove.quaderno
        const pagina = schedaEsistente(k.id)
        // senza note libere si mostrano solo i campi: guardare non crea niente
        return pagina ? (
          <Lettore documento={pagina} titolo={k.nome || tr('Senza nome')} intestazione={<SchedaLettura quaderno={k} />} />
        ) : (
          <article className={s.lettura}>
            <h1 className={s.titoloPagina}>{k.nome || tr('Senza nome')}</h1>
            <SchedaLettura quaderno={k} />
          </article>
        )
      })()}
    </div>
  )
}

function SchedaMateria({ quaderno, pagine, onApri }: { quaderno: Quaderno; pagine: number; onApri: () => void }) {
  const copertina = useImmagine(quaderno.copertinaId)
  return (
    <button className={s.scheda} onClick={onApri}>
      <span className={s.copertina} data-colore={quaderno.colore}>
        {copertina ? <Miniatura src={copertina} alt="" /> : <span>{(quaderno.nome || '?').charAt(0).toUpperCase()}</span>}
      </span>
      <span className={s.nomeMateria}>{quaderno.nome || tr('Senza nome')}</span>
      <span className={s.contoPagine}>{pagine} {pagine === 1 ? 'pagina' : 'pagine'}</span>
    </button>
  )
}

function quando(t: number) {
  const g = Math.floor((Date.now() - t) / 86400000)
  if (g < 1) return 'oggi'
  if (g === 1) return 'ieri'
  if (g < 7) return `${g} giorni fa`
  return new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}
