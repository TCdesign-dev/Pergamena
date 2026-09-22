import { nanoid } from 'nanoid'
import type { Collegamento, Quaderno } from '../documento/tipi'
import { aggiornaQuaderno } from '../documento/archivio'
import { Icona } from '../lib/Icona'
import s from './Scheda.module.css'

/** «moodle.unito.it» diventa un indirizzo che si apre davvero. */
export function indirizzo(url: string) {
  const u = url.trim()
  if (!u) return ''
  return /^[a-z]+:\/\//i.test(u) ? u : `https://${u}`
}

export function Collegamenti({ quaderno, nuovo, onNuovo }: {
  quaderno: Quaderno
  nuovo: string | null
  onNuovo: (id: string) => void
}) {
  const elenco = quaderno.collegamenti ?? []
  const salva = (c: Collegamento[]) => aggiornaQuaderno(quaderno.id, { collegamenti: c })
  const cambia = (id: string, modifica: Partial<Collegamento>) =>
    salva(elenco.map((c) => (c.id === id ? { ...c, ...modifica } : c)))

  return (
    <div className={s.valoreLista}>
      {elenco.map((c) => (
        <div key={c.id} className={s.collegamento}>
          <input
            className={s.campo}
            value={c.titolo}
            placeholder="Moodle, sito del corso…"
            autoFocus={c.id === nuovo}
            onChange={(e) => cambia(c.id, { titolo: e.target.value })}
          />
          <input
            className={`${s.campo} ${s.url}`}
            value={c.url}
            placeholder="indirizzo"
            onChange={(e) => cambia(c.id, { url: e.target.value })}
          />
          {c.url.trim() && (
            <a className={s.apri} href={indirizzo(c.url)} target="_blank" rel="noreferrer" title="Apri il link" aria-label="Apri il link"><Icona nome="apri-fuori" dimensione={14} /></a>
          )}
          <button className={s.togli} title="Togli questo link" aria-label="Togli questo link" onClick={() => salva(elenco.filter((x) => x.id !== c.id))}><Icona nome="chiudi" dimensione={14} /></button>
        </div>
      ))}
      <button
        className={s.aggiungi}
        onClick={() => {
          const id = nanoid(8)
          salva([...elenco, { id, titolo: '', url: '' }])
          onNuovo(id)
        }}
      >
        <Icona nome="nuovo" dimensione={14} /> Aggiungi un link
      </button>
    </div>
  )
}
