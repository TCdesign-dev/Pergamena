import { useState } from 'react'
import { creaQuaderno, creaDocumento, rinominaQuaderno } from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import { useImmagine } from '../immagini/useImmagine'
import s from './Home.module.css'

/*  La prima cosa che vedi quando non stai scrivendo: le materie, con
 *  la loro copertina. Non è una dashboard — non ci sono numeri da
 *  guardare — è uno scaffale. */

export function Home({
  quaderni, documenti, onApri, onCopertina, onElimina,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  onApri: (idDocumento: string) => void
  onCopertina: (quaderno: Quaderno) => void
  onElimina: (quaderno: Quaderno) => void
}) {
  const [inRinomina, setInRinomina] = useState<string | null>(null)

  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <h1 className={s.titolo}>Le tue materie</h1>
        <p className={s.sottotitolo}>
          {quaderni.length === 0
            ? 'Non ce n’è ancora nessuna.'
            : `${quaderni.length} materie · ${documenti.length} pagine`}
        </p>
      </header>

      <div className={s.griglia}>
        {quaderni.map((q) => (
          <Scheda
            key={q.id}
            quaderno={q}
            pagine={documenti.filter((d) => d.quadernoId === q.id)}
            inRinomina={inRinomina === q.id}
            onRinomina={() => setInRinomina(q.id)}
            onFineRinomina={() => setInRinomina(null)}
            onApri={onApri}
            onCopertina={() => onCopertina(q)}
            onElimina={() => onElimina(q)}
          />
        ))}

        <button
          className={s.nuova}
          onClick={() => {
            const q = creaQuaderno('')
            setInRinomina(q.id)
            creaDocumento(q.id)
          }}
        >
          <span className={s.piu}>+</span>
          <span>Nuova materia</span>
        </button>
      </div>
    </div>
  )
}

function Scheda({
  quaderno, pagine, inRinomina, onRinomina, onFineRinomina, onApri, onCopertina, onElimina,
}: {
  quaderno: Quaderno
  pagine: Documento[]
  inRinomina: boolean
  onRinomina: () => void
  onFineRinomina: () => void
  onApri: (id: string) => void
  onCopertina: () => void
  onElimina: () => void
}) {
  const copertina = useImmagine(quaderno.copertinaId)
  const recente = [...pagine].sort((a, b) => b.modificato - a.modificato)[0]

  return (
    <article className={s.scheda}>
      <button
        className={s.copertina}
        data-colore={quaderno.colore}
        onClick={() => {
          if (recente) onApri(recente.id)
          else onApri(creaDocumento(quaderno.id, '').id)
        }}
      >
        {copertina ? (
          <img src={copertina} alt="" draggable={false} />
        ) : (
          <span className={s.iniziale}>{(quaderno.nome || '?').trim().charAt(0).toUpperCase()}</span>
        )}
      </button>

      <div className={s.comandi}>
        <button title="Cambia copertina" onClick={onCopertina}>◫</button>
        <button title="Elimina la materia" onClick={onElimina}>⌫</button>
      </div>

      <div className={s.didascalia}>
        {inRinomina ? (
          <input
            className={s.campoNome}
            autoFocus
            defaultValue={quaderno.nome}
            placeholder="Nome materia"
            onChange={(e) => rinominaQuaderno(quaderno.id, e.target.value)}
            onBlur={onFineRinomina}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          />
        ) : (
          <button className={s.nome} onDoubleClick={onRinomina} onClick={() => recente && onApri(recente.id)}>
            {quaderno.nome || 'Senza nome'}
          </button>
        )}
        <span className={s.conteggio}>
          {pagine.length === 0 ? 'vuota' : `${pagine.length} ${pagine.length === 1 ? 'pagina' : 'pagine'}`}
        </span>
      </div>
    </article>
  )
}
