import { useState } from 'react'
import {
  creaQuaderno, creaDocumento, eliminaDocumento, rinominaQuaderno,
} from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import {
  ORDINI, ETICHETTE_ORDINE, leggiOrdine, salvaOrdine, ordina, type Ordine,
} from '../documento/ordinamento'
import s from './BarraLaterale.module.css'

export function BarraLaterale({
  quaderni, documenti, apertoId, onApri,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  apertoId: string | null
  onApri: (id: string, fuoco?: Fuoco) => void
}) {
  // la materia appena creata nasce già in modifica: niente finestrelle
  const [inRinomina, setInRinomina] = useState<string | null>(null)
  const [ordine, setOrdine] = useState<Ordine>(leggiOrdine)

  function cambiaOrdine() {
    const prossimo = ORDINI[(ORDINI.indexOf(ordine) + 1) % ORDINI.length]
    setOrdine(prossimo)
    salvaOrdine(prossimo)
  }

  const inOrdine = ordina(documenti, ordine)

  function nuovaMateria() {
    const q = creaQuaderno('')
    setInRinomina(q.id)
    // 'niente': stai per scrivere il nome della materia, il cursore resta qui
    onApri(creaDocumento(q.id).id, 'niente')
  }

  return (
    <nav className={s.barra}>
      <header className={s.testa}>
        <span className={s.marchio}>Pergamena</span>
        <button className={s.piu} title="Nuova materia" onClick={nuovaMateria}>+</button>
      </header>

      {quaderni.length > 0 && (
        <button
          className={s.ordine}
          title="Cambia l'ordine dei documenti"
          onClick={cambiaOrdine}
        >
          <span>per {ETICHETTE_ORDINE[ordine]}</span>
          <span className={s.frecciaOrdine}>⇅</span>
        </button>
      )}

      {quaderni.length === 0 && (
        <p className={s.vuoto}>
          Nessuna materia.<br />Premi <b>+</b> per crearne una.
        </p>
      )}

      {quaderni.map((q) => (
        <section key={q.id} className={s.quaderno}>
          <div className={s.titoloQuaderno}>
            <span className={s.pallino} data-colore={q.colore} />

            {inRinomina === q.id ? (
              <input
                className={s.campoNome}
                autoFocus
                defaultValue={q.nome}
                placeholder="Nome materia"
                onChange={(e) => rinominaQuaderno(q.id, e.target.value)}
                onBlur={() => setInRinomina(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                }}
              />
            ) : (
              <button
                className={s.nome}
                title="Doppio clic per rinominare"
                onDoubleClick={() => setInRinomina(q.id)}
              >
                {q.nome || 'Senza nome'}
              </button>
            )}

            <button
              className={s.piu}
              title="Nuovo documento"
              onClick={() => onApri(creaDocumento(q.id).id, 'titolo')}
            >
              +
            </button>
          </div>

          <ul className={s.elenco}>
            {inOrdine
              .filter((d) => d.quadernoId === q.id)
              .map((d) => (
                <li key={d.id}>
                  <button
                    className={`${s.voce} ${d.id === apertoId ? s.vocePiena : ''}`}
                    onClick={() => onApri(d.id, 'corpo')}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (confirm(`Eliminare «${d.titolo || 'Senza titolo'}»?`)) {
                        void eliminaDocumento(d.id)
                      }
                    }}
                  >
                    <span className={s.voceTitolo}>{d.titolo || 'Senza titolo'}</span>
                    <span className={s.voceData}>
                      {ordine === 'titolo' ? '' : quando(ordine === 'creazione' ? d.creato : d.modificato)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
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
