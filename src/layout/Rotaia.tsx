import { creaQuaderno, creaDocumento, soloPagine } from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import { Icona } from '../lib/Icona'
import s from './Rotaia.module.css'

/*  La barra laterale chiusa: una colonna di icone larga 48 px. Sotto i
 *  900 px è così di partenza (a 716, in aula, la colonna di scrittura si
 *  riprende quasi 200 px); sopra, quando la chiudi con ⌘\.
 *
 *  Dall'alto: la barra intera, la ricerca, le materie; un pallino per
 *  materia, che apre l'ultima pagina toccata come la copertina nella
 *  home; una materia nuova. In fondo l'archivio. */

export function Rotaia({
  quaderni, documenti, materiaInVista, inHome, archivioAperto, onBarra, onCerca, onHome, onApri, onArchivio,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  /** la materia della pagina, della scheda o del ripasso che si sta guardando */
  materiaInVista: string | null
  inHome: boolean
  archivioAperto: boolean
  onBarra: () => void
  onCerca: () => void
  onHome: () => void
  onApri: (id: string, fuoco?: Fuoco) => void
  onArchivio: () => void
}) {
  const pagine = documenti.filter(soloPagine)

  function apriMateria(q: Quaderno) {
    const recente = pagine
      .filter((d) => d.quadernoId === q.id)
      .sort((a, b) => b.modificato - a.modificato)[0]
    onApri(recente ? recente.id : creaDocumento(q.id, '').id)
  }

  return (
    <nav className={s.rotaia} aria-label="Navigazione">
      <button className={s.pulsante} onClick={onBarra} aria-label="Apri la barra laterale (⌘\)" title="Barra laterale  ⌘\">
        <Icona nome="barra-laterale" />
      </button>
      <button className={s.pulsante} onClick={onCerca} aria-label="Cerca e comandi (⌘K)" title="Cerca  ⌘K">
        <Icona nome="cerca" />
      </button>
      <button className={`${s.pulsante} ${inHome ? s.attivo : ''}`} onClick={onHome} aria-label="Le tue materie" title="Le tue materie">
        <Icona nome="materie" />
      </button>

      <span className={s.separatore} aria-hidden />

      <div className={s.materie}>
        {quaderni.map((q) => (
          <button
            key={q.id}
            className={`${s.pulsante} ${materiaInVista === q.id ? s.attivo : ''}`}
            onClick={() => apriMateria(q)}
            aria-label={q.nome || 'Senza nome'}
            title={q.nome || 'Senza nome'}
          >
            <span className={s.pallino} data-colore={q.colore} />
          </button>
        ))}
        <button
          className={`${s.pulsante} ${s.spento}`}
          onClick={() => { const q = creaQuaderno(''); onApri(creaDocumento(q.id).id, 'titolo') }}
          aria-label="Nuova materia"
          title="Nuova materia"
        >
          <Icona nome="nuovo" />
        </button>
      </div>

      <span className={s.spazio} />

      <button className={`${s.pulsante} ${archivioAperto ? s.attivo : ''}`} onClick={onArchivio} aria-label="Archivio" title="Archivio">
        <Icona nome="archivio" />
      </button>
    </nav>
  )
}
