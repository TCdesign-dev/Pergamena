import { nanoid } from 'nanoid'
import type { Esame, Quaderno } from '../documento/tipi'
import { aggiornaQuaderno } from '../documento/archivio'
import { comeDetto, inOrdine, mancano } from '../lib/esami'
import { Icona } from '../lib/Icona'
import s from './Scheda.module.css'

/*  Le prove d'esame: parziale, scritto, orale. Si scrivono al loro
 *  posto, senza finestre: una riga per prova, e la riga stessa è il
 *  modulo. Il conto alla rovescia accanto alla data è la ragione per
 *  cui questo campo è strutturato e non testo libero. */

export function Esami({ quaderno, nuovo, onNuovo }: {
  quaderno: Quaderno
  nuovo: string | null            // l'esame appena aggiunto, da mettere a fuoco
  onNuovo: (id: string) => void
}) {
  const esami = quaderno.esami ?? []

  const salva = (elenco: Esame[]) => aggiornaQuaderno(quaderno.id, { esami: elenco })
  const cambia = (id: string, modifica: Partial<Esame>) =>
    salva(esami.map((e) => (e.id === id ? { ...e, ...modifica } : e)))

  return (
    <div className={s.valoreLista}>
      {inOrdine(esami).map((e) => {
        const passato = e.data ? mancano(e.data) < 0 : false
        const vicino = e.data ? mancano(e.data) >= 0 && mancano(e.data) <= 14 : false
        return (
          <div key={e.id} className={`${s.esame} ${passato ? s.passato : ''}`}>
            <input
              className={s.campo}
              value={e.nome}
              placeholder="Scritto, orale…"
              autoFocus={e.id === nuovo}
              onChange={(ev) => cambia(e.id, { nome: ev.target.value })}
            />
            <input
              className={`${s.campo} ${s.data}`}
              type="date"
              value={e.data}
              onChange={(ev) => cambia(e.id, { data: ev.target.value })}
            />
            <span className={`${s.mancano} ${vicino ? s.vicino : ''}`}>
              {e.data ? comeDetto(e.data) : ''}
            </span>
            <input
              className={`${s.campo} ${s.nota}`}
              value={e.nota ?? ''}
              placeholder="nota"
              onChange={(ev) => cambia(e.id, { nota: ev.target.value })}
            />
            <button className={s.togli} title="Togli questa prova" aria-label="Togli questa prova" onClick={() => salva(esami.filter((x) => x.id !== e.id))}><Icona nome="chiudi" dimensione={14} /></button>
          </div>
        )
      })}
      <button
        className={s.aggiungi}
        onClick={() => {
          const id = nanoid(8)
          salva([...esami, { id, nome: '', data: '' }])
          onNuovo(id)
        }}
      >
        <Icona nome="nuovo" dimensione={14} /> Aggiungi una prova
      </button>
    </div>
  )
}
