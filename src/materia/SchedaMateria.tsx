import { useEffect, useState } from 'react'
import type { Quaderno } from '../documento/tipi'
import { schedaDi, schedaEsistente } from '../documento/archivio'
import { Editor, type RifEditore } from '../editor/Editor'
import { Testata } from './Testata'
import s from './Scheda.module.css'
import { tr } from '../lingua/lingua'

/*  La scheda della materia: in cima i campi che fanno qualcosa (le
 *  date d'esame, l'email, i link), sotto una pagina libera per tutto
 *  il resto — programma, libri, regole d'esame. È un documento come
 *  gli altri: si scrive con lo stesso editor, si sincronizza, si
 *  cerca con ⌘K, e se ne va insieme alla materia. */

export function SchedaMateria({ quaderno, rifEditore, onHome, onCopertina }: {
  quaderno: Quaderno
  rifEditore: RifEditore
  onHome: () => void
  onCopertina: (q: Quaderno) => void
}) {
  /*  La pagina delle note nasce la prima volta che apri la scheda —
   *  in un effetto, non durante il disegno: crearla scrive nell'indice
   *  Yjs, e un aggiornamento di stato in mezzo al disegno di un altro
   *  componente è un errore in React. */
  const [pagina, setPagina] = useState(() => schedaEsistente(quaderno.id))
  useEffect(() => {
    setPagina(schedaEsistente(quaderno.id) ?? schedaDi(quaderno.id))
  }, [quaderno.id])

  if (!pagina) return <div className={s.vista} />

  return (
    <div className={s.vista}>
      <nav className={s.percorso}>
        <button className={s.passo} onClick={onHome}>{tr('Materie')}</button>
        <span className={s.sbarra}>/</span>
        <span className={s.qui}>{quaderno.nome || tr('Senza nome')} · scheda</span>
      </nav>

      <Editor
        documento={pagina}
        fuoco="niente"
        rifEditore={rifEditore}
        intestazione={<Testata quaderno={quaderno} onCopertina={() => onCopertina(quaderno)} />}
        segnaposto={tr('Programma, libri, regole d’esame… tutto quello che ti serve sapere su questa materia.')}
      />
    </div>
  )
}
