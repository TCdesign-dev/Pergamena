import { useState } from 'react'
import { creaQuaderno, creaDocumento, rinominaQuaderno, soloPagine } from '../documento/archivio'
import { prossimoEsame, comeDetto, mancano } from '../lib/esami'
import type { Quaderno, Documento } from '../documento/tipi'
import { useImmagine } from '../immagini/useImmagine'
import { Miniatura } from './Miniatura'
import { Icona } from '../lib/Icona'
import s from './Home.module.css'

/*  La prima cosa che vedi quando non stai scrivendo: le materie, con
 *  la loro copertina. Non è una dashboard — non ci sono numeri da
 *  guardare — è uno scaffale. */

export function Home({
  quaderni, documenti, onApri, onScheda, onRipasso, onArchivio, onCopertina, onElimina,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  onApri: (idDocumento: string) => void
  onScheda: (quadernoId: string) => void
  onRipasso: (quadernoId: string) => void
  onArchivio: () => void
  onCopertina: (quaderno: Quaderno) => void
  onElimina: (quaderno: Quaderno) => void
}) {
  const [inRinomina, setInRinomina] = useState<string | null>(null)
  const pagineTutte = documenti.filter(soloPagine)

  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <h1 className={s.titolo}>Le tue materie</h1>
        <p className={s.sottotitolo}>
          {quaderni.length === 0
            ? 'Non ce n’è ancora nessuna.'
            : `${quaderni.length} materie · ${pagineTutte.length} pagine`}
          {quaderni.length > 0 && <> · <button className={s.archivio} onClick={onArchivio}>archivio</button></>}
        </p>
      </header>

      <div className={s.griglia}>
        {quaderni.map((q) => (
          <Scheda
            key={q.id}
            quaderno={q}
            pagine={pagineTutte.filter((d) => d.quadernoId === q.id)}
            inRinomina={inRinomina === q.id}
            onScheda={() => onScheda(q.id)}
            onRipasso={() => onRipasso(q.id)}
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
          <Icona nome="nuovo" dimensione={24} />
          <span>Nuova materia</span>
        </button>
      </div>
    </div>
  )
}

function Scheda({
  quaderno, pagine, inRinomina, onScheda, onRipasso, onRinomina, onFineRinomina, onApri, onCopertina, onElimina,
}: {
  quaderno: Quaderno
  pagine: Documento[]
  inRinomina: boolean
  onScheda: () => void
  onRipasso: () => void
  onRinomina: () => void
  onFineRinomina: () => void
  onApri: (id: string) => void
  onCopertina: () => void
  onElimina: () => void
}) {
  const copertina = useImmagine(quaderno.copertinaId)
  const recente = [...pagine].sort((a, b) => b.modificato - a.modificato)[0]
  const esame = prossimoEsame(quaderno)
  const vicino = esame ? mancano(esame.data) <= 14 : false

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
          <Miniatura src={copertina} alt="" draggable={false} />
        ) : (
          <span className={s.iniziale}>{(quaderno.nome || '?').trim().charAt(0).toUpperCase()}</span>
        )}
      </button>

      <div className={s.comandi}>
        <button title="Scheda della materia" aria-label="Scheda della materia" onClick={onScheda}><Icona nome="materia" dimensione={14} /></button>
        <button title="Ripasso e quiz" aria-label="Ripasso e quiz" onClick={onRipasso}><Icona nome="ripasso" dimensione={14} /></button>
        <button title="Cambia copertina" aria-label="Cambia copertina" onClick={onCopertina}><Icona nome="immagini" dimensione={14} /></button>
        <button title="Elimina la materia" aria-label="Elimina la materia" onClick={onElimina}><Icona nome="elimina" dimensione={14} /></button>
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
        {/* il prossimo esame: è il motivo per cui la data è un campo e non testo */}
        {esame && (
          <button className={`${s.esame} ${vicino ? s.esameVicino : ''}`} onClick={onScheda} title="Apri la scheda">
            {esame.nome || 'Esame'} {comeDetto(esame.data)}
          </button>
        )}
      </div>
    </article>
  )
}
