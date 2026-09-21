import { useState } from 'react'
import type { Quaderno } from '../documento/tipi'
import { aggiornaQuaderno, rinominaQuaderno } from '../documento/archivio'
import { useImmagine } from '../immagini/useImmagine'
import { Esami } from './Esami'
import { Collegamenti } from './Collegamenti'
import { Miniatura } from '../layout/Miniatura'
import s from './Scheda.module.css'

/*  Copertina, nome e i pochi campi strutturati, in cima alla scheda,
 *  come le proprietà in cima a una pagina di Notion. Sotto, il testo
 *  libero: tutto quello che non ha bisogno di una forma. */

export function Testata({ quaderno, onCopertina }: { quaderno: Quaderno; onCopertina: () => void }) {
  const copertina = useImmagine(quaderno.copertinaId)
  const [nuovo, setNuovo] = useState<string | null>(null)
  const emailValida = /^\S+@\S+\.\S+$/.test(quaderno.email ?? '')

  return (
    <header className={s.testata}>
      {copertina ? (
        <div className={s.copertina}>
          <Miniatura src={copertina} alt="" draggable={false} />
          <button className={s.cambiaCopertina} onClick={onCopertina}>Cambia copertina</button>
        </div>
      ) : (
        <button className={s.aggiungiCopertina} onClick={onCopertina}>+ Aggiungi una copertina</button>
      )}

      <input
        className={s.nome}
        value={quaderno.nome}
        placeholder="Nome della materia"
        onChange={(e) => rinominaQuaderno(quaderno.id, e.target.value)}
      />

      <dl className={s.campi}>
        <dt>Esami</dt>
        <dd><Esami quaderno={quaderno} nuovo={nuovo} onNuovo={setNuovo} /></dd>

        <dt>Docente</dt>
        <dd>
          <input
            className={s.campo}
            value={quaderno.docente ?? ''}
            placeholder="Vuoto"
            onChange={(e) => aggiornaQuaderno(quaderno.id, { docente: e.target.value })}
          />
        </dd>

        <dt>Email</dt>
        <dd className={s.conAzione}>
          <input
            className={s.campo}
            type="email"
            value={quaderno.email ?? ''}
            placeholder="Vuoto"
            onChange={(e) => aggiornaQuaderno(quaderno.id, { email: e.target.value })}
          />
          {emailValida && (
            <a className={s.apri} href={`mailto:${quaderno.email}`} title="Scrivi">↗</a>
          )}
        </dd>

        <dt>Ricevimento</dt>
        <dd>
          <input
            className={s.campo}
            value={quaderno.ricevimento ?? ''}
            placeholder="Vuoto"
            onChange={(e) => aggiornaQuaderno(quaderno.id, { ricevimento: e.target.value })}
          />
        </dd>

        <dt>Link</dt>
        <dd><Collegamenti quaderno={quaderno} nuovo={nuovo} onNuovo={setNuovo} /></dd>
      </dl>

      <div className={s.separatore} />
    </header>
  )
}
