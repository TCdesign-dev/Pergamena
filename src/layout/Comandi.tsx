import { useEffect, useMemo, useState } from 'react'
import { creaQuaderno, creaDocumento } from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import { normalizza } from '../lib/testo'
import s from './Comandi.module.css'

/*  ⌘K: l'unico punto d'ingresso.
 *  È il motivo per cui in cima all'app non c'è una barra di ricerca
 *  né una barra degli strumenti: quello che serve si chiama, non si
 *  cerca con il mouse. */

type Riga =
  | { tipo: 'documento'; chiave: string; titolo: string; materia: string; id: string }
  | { tipo: 'azione'; chiave: string; titolo: string; materia: string; esegui: () => void }

export function Comandi({
  quaderni, documenti, onApri, onChiudi,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  onApri: (id: string, fuoco?: Fuoco) => void
  onChiudi: () => void
}) {
  const [query, setQuery] = useState('')
  const [indice, setIndice] = useState(0)

  const righe = useMemo<Riga[]>(() => {
    const nomeMateria = (id: string) => quaderni.find((q) => q.id === id)?.nome || 'Senza nome'

    const docs: Riga[] = documenti.map((d) => ({
      tipo: 'documento',
      chiave: `d-${d.id}`,
      id: d.id,
      titolo: d.titolo || 'Senza titolo',
      materia: nomeMateria(d.quadernoId),
    }))

    const azioni: Riga[] = [
      ...quaderni.map((q) => ({
        tipo: 'azione' as const,
        chiave: `n-${q.id}`,
        titolo: `Nuovo documento in ${q.nome || 'Senza nome'}`,
        materia: 'azione',
        esegui: () => onApri(creaDocumento(q.id).id, 'titolo'),
      })),
      {
        tipo: 'azione',
        chiave: 'nuova-materia',
        titolo: 'Nuova materia',
        materia: 'azione',
        esegui: () => onApri(creaDocumento(creaQuaderno('').id).id, 'titolo'),
      },
    ]

    const q = normalizza(query.trim())
    const passa = (r: Riga) =>
      !q || normalizza(r.titolo).includes(q) || normalizza(r.materia).includes(q)

    return [...docs.filter(passa), ...azioni.filter(passa)]
  }, [quaderni, documenti, query, onApri])

  useEffect(() => setIndice(0), [query])

  function scegli(r: Riga | undefined) {
    if (!r) return
    if (r.tipo === 'documento') onApri(r.id, 'corpo')
    else r.esegui()
    onChiudi()
  }

  return (
    <div className={s.velo} onMouseDown={onChiudi}>
      <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
        <input
          className={s.campo}
          autoFocus
          value={query}
          placeholder="Vai a un documento, o crea…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (i + 1) % Math.max(righe.length, 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (i - 1 + righe.length) % Math.max(righe.length, 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); scegli(righe[indice]) }
            else if (e.key === 'Escape') { e.preventDefault(); onChiudi() }
          }}
        />

        <div className={s.elenco}>
          {righe.length === 0 && <p className={s.nulla}>Nessun risultato</p>}
          {righe.map((r, i) => (
            <button
              key={r.chiave}
              className={`${s.riga} ${i === indice ? s.scelta : ''}`}
              ref={i === indice ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => scegli(r)}
            >
              <span className={s.titolo}>{r.titolo}</span>
              {r.tipo === 'documento' && <span className={s.materia}>{r.materia}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
