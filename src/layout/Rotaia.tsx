import { creaQuaderno, creaDocumento, soloPagine } from '../documento/archivio'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import { Icona } from '../lib/Icona'
import s from './Rotaia.module.css'
import { tr } from '../lingua/lingua'

/*  La barra laterale chiusa: una colonna di icone larga 48 px. Sotto i
 *  900 px è così di partenza (a 716, in aula, la colonna di scrittura si
 *  riprende quasi 200 px); sopra, quando la chiudi con ⌘\.
 *
 *  Dall'alto: la barra intera, la ricerca, le materie; un pallino per
 *  materia, che apre l'ultima pagina toccata come la copertina nella
 *  home; una materia nuova. In fondo l'archivio e le impostazioni. */

export function Rotaia({
  quaderni, documenti, materiaInVista, inHome, archivioAperto, onBarra, onCerca, onHome, onApri, onArchivio, onImpostazioni,
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
  onImpostazioni: () => void
}) {
  const pagine = documenti.filter(soloPagine)

  function apriMateria(q: Quaderno) {
    const recente = pagine
      .filter((d) => d.quadernoId === q.id)
      .sort((a, b) => b.modificato - a.modificato)[0]
    onApri(recente ? recente.id : creaDocumento(q.id, '').id)
  }

  return (
    <nav className={s.rotaia} aria-label={tr('Navigazione')}>
      <button className={s.pulsante} onClick={onBarra} aria-label={tr('Apri la barra laterale (⌘\\)')} title={tr('Barra laterale  ⌘\\')}>
        <Icona nome="barra-laterale" />
      </button>
      <button className={s.pulsante} onClick={onCerca} aria-label={tr('Cerca e comandi (⌘K)')} title={tr('Cerca  ⌘K')}>
        <Icona nome="cerca" />
      </button>
      <button className={`${s.pulsante} ${inHome ? s.attivo : ''}`} onClick={onHome} aria-label={tr('Le tue materie')} title={tr('Le tue materie')}>
        <Icona nome="materie" />
      </button>

      <span className={s.separatore} aria-hidden />

      <div className={s.materie}>
        {quaderni.map((q) => (
          <button
            key={q.id}
            className={`${s.pulsante} ${materiaInVista === q.id ? s.attivo : ''}`}
            onClick={() => apriMateria(q)}
            aria-label={q.nome || tr('Senza nome')}
            title={q.nome || tr('Senza nome')}
          >
            <span className={s.pallino} data-colore={q.colore} />
          </button>
        ))}
        <button
          className={`${s.pulsante} ${s.spento}`}
          onClick={() => { const q = creaQuaderno(''); onApri(creaDocumento(q.id).id, 'titolo') }}
          aria-label={tr('Nuova materia')}
          title={tr('Nuova materia')}
        >
          <Icona nome="nuovo" />
        </button>
      </div>

      <span className={s.spazio} />

      <button className={`${s.pulsante} ${archivioAperto ? s.attivo : ''}`} onClick={onArchivio} aria-label={tr('Archivio')} title={tr('Archivio')}>
        <Icona nome="archivio" />
      </button>
      <button className={s.pulsante} onClick={onImpostazioni} aria-label={tr('Impostazioni (⌘,)')} title={tr('Impostazioni  ⌘,')}>
        <Icona nome="impostazioni" />
      </button>
    </nav>
  )
}
