import { useState } from 'react'
import { creaQuaderno, creaDocumento, soloPagine } from '../documento/archivio'
import { prossimoEsame, mancano } from '../lib/esami'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import {
  ORDINI, ETICHETTE_ORDINE, leggiOrdine, salvaOrdine, ordina, type Ordine,
} from '../documento/ordinamento'
import { StatoSincronia } from './StatoSincronia'
import s from './BarraLaterale.module.css'

export function BarraLaterale({
  quaderni, documenti, apertoId, inHome, schedaAperta, onApri, onScheda, onRipasso, onHome, onAccedi, onEliminaPagina, onEliminaMateria,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  apertoId: string | null
  inHome: boolean
  schedaAperta: string | null
  onApri: (id: string, fuoco?: Fuoco) => void
  onScheda: (quadernoId: string) => void
  onRipasso: (quadernoId: string) => void
  onHome: () => void
  onAccedi: () => void
  onEliminaPagina: (d: Documento) => void
  onEliminaMateria: (q: Quaderno) => void
}) {
  const [ordine, setOrdine] = useState<Ordine>(leggiOrdine)
  const [chiusi, setChiusi] = useState<Set<string>>(new Set())

  function cambiaOrdine() {
    const p = ORDINI[(ORDINI.indexOf(ordine) + 1) % ORDINI.length]
    setOrdine(p)
    salvaOrdine(p)
  }

  function piega(id: string) {
    setChiusi((c) => {
      const n = new Set(c)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const inOrdine = ordina(documenti.filter(soloPagine), ordine)

  return (
    <nav className={s.barra}>
      <div className={s.alto}>
        <button className={`${s.home} ${inHome ? s.attivo : ''}`} onClick={onHome}>
          <span className={s.marchio}>Pergamena</span>
        </button>

        <button
          className={s.ordine}
          title="Cambia l’ordine delle pagine"
          onClick={cambiaOrdine}
        >
          {ETICHETTE_ORDINE[ordine]} ⇅
        </button>
      </div>

      <div className={s.elencoMaterie}>
        {quaderni.length === 0 && (
          <p className={s.vuoto}>Nessuna materia.<br />Creane una dalla Home.</p>
        )}

        {quaderni.map((q) => {
          const pagine = inOrdine.filter((d) => d.quadernoId === q.id)
          const chiuso = chiusi.has(q.id)
          const esame = prossimoEsame(q)
          const giorni = esame ? mancano(esame.data) : null

          return (
            <section key={q.id} className={s.materia}>
              <div className={s.intestazione}>
                <button className={s.piega} onClick={() => piega(q.id)} title={chiuso ? 'Apri' : 'Chiudi'}>
                  <span className={`${s.freccia} ${chiuso ? s.chiusa : ''}`}>▾</span>
                </button>
                <span className={s.pallino} data-colore={q.colore} />
                <button className={`${s.nome} ${schedaAperta === q.id ? s.nomeScheda : ''}`} onClick={() => piega(q.id)}>
                  {q.nome || 'Senza nome'}
                </button>
                {/* un esame vicino si vede anche da qui, in piccolo */}
                {giorni !== null && giorni <= 14 && (
                  <span className={s.esameVicino} title={`${esame!.nome || 'Esame'}: ${giorni === 0 ? 'oggi' : giorni === 1 ? 'domani' : `fra ${giorni} giorni`}`}>
                    {giorni === 0 ? 'oggi' : `${giorni}g`}
                  </span>
                )}
                <div className={s.azioni}>
                  <button title="Scheda della materia: esami, docente, programma" onClick={() => onScheda(q.id)}>ⓘ</button>
                  <button title="Ripasso: dove eravamo rimasti, argomenti, quiz" onClick={() => onRipasso(q.id)}>↺</button>
                  <button title="Nuova pagina" onClick={() => onApri(creaDocumento(q.id).id, 'titolo')}>+</button>
                  <button title="Elimina la materia" onClick={() => onEliminaMateria(q)}>⌫</button>
                </div>
              </div>

              {!chiuso && (
                <ul className={s.pagine}>
                  {pagine.length === 0 && <li className={s.nessuna}>nessuna pagina</li>}
                  {pagine.map((d) => (
                    <li key={d.id} className={s.riga}>
                      <button
                        className={`${s.pagina} ${d.id === apertoId && !inHome ? s.corrente : ''}`}
                        onClick={() => onApri(d.id, 'corpo')}
                      >
                        <span className={s.titoloPagina}>{d.titolo || 'Senza titolo'}</span>
                        {ordine !== 'titolo' && (
                          <span className={s.data}>
                            {quando(ordine === 'creazione' ? d.creato : d.modificato)}
                          </span>
                        )}
                      </button>
                      <button className={s.cestino} title="Elimina la pagina" onClick={() => onEliminaPagina(d)}>⌫</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        <button
          className={s.nuovaMateria}
          onClick={() => { const q = creaQuaderno(''); onApri(creaDocumento(q.id).id, 'titolo') }}
        >
          + Nuova materia
        </button>
      </div>

      <StatoSincronia onAccedi={onAccedi} />
    </nav>
  )
}

function quando(t: number) {
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return 'ora'
  if (min < 60) return `${min} min`
  const ore = Math.floor(min / 60)
  if (ore < 24) return `${ore} h`
  const giorni = Math.floor(ore / 24)
  if (giorni < 7) return `${giorni} g`
  return new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
