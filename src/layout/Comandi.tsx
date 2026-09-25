import { useEffect, useMemo, useState } from 'react'
import { creaQuaderno, creaDocumento } from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import { useRicerca } from '../ricerca/useRicerca'
import { normalizza } from '../lib/testo'
import s from './Comandi.module.css'
import { tr } from '../lingua/lingua'

/*  ⌘K: l'unico punto d'ingresso.
 *  Cerca nei titoli, poi DENTRO agli appunti, poi offre le azioni.
 *  È il motivo per cui in cima all'app non c'è né una barra di
 *  ricerca né una barra degli strumenti. */

type Riga =
  | { tipo: 'documento'; chiave: string; titolo: string; materia: string; id: string }
  | { tipo: 'contenuto'; chiave: string; titolo: string; materia: string; id: string; frammento: string }
  | { tipo: 'azione'; chiave: string; titolo: string; esegui: () => void }

export function Comandi({
  quaderni, documenti, onApri, onRipasso, onArchivio, onChiudi,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  onApri: (id: string, fuoco?: Fuoco) => void
  onRipasso: (quadernoId: string) => void
  onArchivio: () => void
  onChiudi: () => void
}) {
  const [query, setQuery] = useState('')
  const [indice, setIndice] = useState(0)
  const nelContenuto = useRicerca(query, documenti, quaderni)

  const righe = useMemo<Riga[]>(() => {
    const nomeMateria = (id: string) => quaderni.find((q) => q.id === id)?.nome || tr('Senza nome')
    const q = normalizza(query.trim())

    const perTitolo = documenti
      .map((d) => ({
        tipo: 'documento' as const,
        chiave: `d-${d.id}`,
        id: d.id,
        titolo: d.titolo || tr('Senza titolo'),
        materia: nomeMateria(d.quadernoId),
      }))
      .filter((r) => !q || normalizza(r.titolo).includes(q) || normalizza(r.materia).includes(q))

    // un documento che compare già per titolo non si ripete
    const gia = new Set(perTitolo.map((r) => r.id))
    const perContenuto = nelContenuto
      .filter((r) => !gia.has(r.documentoId))
      .map((r) => ({
        tipo: 'contenuto' as const,
        chiave: `c-${r.documentoId}`,
        id: r.documentoId,
        titolo: r.titolo,
        materia: r.materia,
        frammento: r.frammento,
      }))

    const azioni = [
      ...quaderni.map((k) => ({
        tipo: 'azione' as const,
        chiave: `r-${k.id}`,
        titolo: tr('Ripasso di {nome}: dove eravamo rimasti, quiz', { nome: k.nome || tr('Senza nome') }),
        esegui: () => onRipasso(k.id),
      })),
      ...quaderni.map((k) => ({
        tipo: 'azione' as const,
        chiave: `n-${k.id}`,
        titolo: tr('Nuovo documento in {nome}', { nome: k.nome || tr('Senza nome') }),
        esegui: () => onApri(creaDocumento(k.id).id, 'titolo'),
      })),
      {
        tipo: 'azione' as const,
        chiave: 'archivio',
        titolo: tr('Archivio: quanto occupa cosa, e cosa togliere'),
        esegui: onArchivio,
      },
      {
        tipo: 'azione' as const,
        chiave: 'nuova-materia',
        titolo: tr('Nuova materia'),
        esegui: () => onApri(creaDocumento(creaQuaderno('').id).id, 'titolo'),
      },
    ].filter((r) => !q || normalizza(r.titolo).includes(q))

    return [...perTitolo, ...perContenuto, ...azioni]
  }, [quaderni, documenti, query, nelContenuto, onApri, onRipasso, onArchivio])

  useEffect(() => setIndice(0), [query])
  useEffect(() => {
    setIndice((i) => Math.min(i, Math.max(righe.length - 1, 0)))
  }, [righe.length])

  function scegli(r: Riga | undefined) {
    if (!r) return
    if (r.tipo === 'azione') r.esegui()
    else onApri(r.id, 'corpo')
    onChiudi()
  }

  const muovi = (passo: number) =>
    setIndice((i) => (i + passo + righe.length) % Math.max(righe.length, 1))

  return (
    <div className={s.velo} onMouseDown={onChiudi}>
      <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
        <input
          className={s.campo}
          autoFocus
          value={query}
          placeholder={tr('Cerca nei titoli e negli appunti, o crea…')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); muovi(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); muovi(-1) }
            else if (e.key === 'Enter') { e.preventDefault(); scegli(righe[indice]) }
            else if (e.key === 'Escape') { e.preventDefault(); onChiudi() }
          }}
        />

        <div className={s.elenco}>
          {righe.length === 0 && <p className={s.nulla}>{tr('Nessun risultato')}</p>}
          {righe.map((r, i) => (
            <button
              key={r.chiave}
              className={`${s.riga} ${i === indice ? s.scelta : ''}`}
              ref={i === indice ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => scegli(r)}
            >
              <span className={s.capo}>
                <span className={s.titolo}>{r.titolo}</span>
                {r.tipo !== 'azione' && <span className={s.materia}>{r.materia}</span>}
              </span>
              {r.tipo === 'contenuto' && <span className={s.frammento}>{r.frammento}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
