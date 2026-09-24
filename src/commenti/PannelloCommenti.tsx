import { useEffect, useReducer } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import { togliCommento, useCommenti } from './deposito'
import { commentiInPagina, elementoDi, togliSegno } from './posizione'
import { apriCommento } from './statoScheda'
import type { Commento } from './tipi'
import { scrittaDiComando } from '../tastiera/scorciatoie'
import { quandoFa } from '../lib/quando'
import { Icona } from '../lib/Icona'
import s from './PannelloCommenti.module.css'

/*  Tutti i commenti della pagina, in fila.
 *
 *  Nell'ordine in cui stanno nella pagina, non in quello in cui li hai
 *  scritti: è l'ordine in cui si rileggono. In fondo quelli rimasti
 *  senza testo — la frase commentata l'hai riscritta o cancellata —
 *  che altrimenti sparirebbero senza dire niente.
 *
 *  Come il pannello Lezioni: tendina sotto la barra, oppure colonna di
 *  destra da 1200 px in su. */

export function PannelloCommenti({ doc, rifEditore, modo, onChiudi }: {
  doc: Y.Doc
  rifEditore: RifEditore
  modo: 'tendina' | 'lato'
  onChiudi: () => void
}) {
  const commenti = useCommenti(doc)
  const [, ridisegna] = useReducer((n: number) => n + 1, 0)

  // scrivendo cambia l'ordine dei commenti nella pagina, e qualcuno
  // resta senza testo: la lista segue
  useEffect(() => {
    const editor = rifEditore.current
    if (!editor) return
    editor.on('update', ridisegna)
    return () => { editor.off('update', ridisegna) }
  }, [rifEditore, commenti.length])

  useEffect(() => {
    const giu = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onChiudi() }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [onChiudi])

  const editor = rifEditore.current
  const ordine = editor ? commentiInPagina(editor) : []
  const posto = (c: Commento) => {
    const i = ordine.indexOf(c.id)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const elenco = [...commenti].sort((a, b) => posto(a) - posto(b) || a.quando - b.quando)

  function vai(c: Commento) {
    const el = editor ? elementoDi(editor, c.id) : null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (el) apriCommento(c.id)
    if (modo === 'tendina') onChiudi()
  }

  function risolvi(c: Commento) {
    if (editor) togliSegno(editor, c.id)
    togliCommento(doc, c.id)
  }

  return (
    <div className={s.pannello} data-modo={modo}>
      <header className={s.testa}>
        <span className={s.titolo}>{modo === 'lato' ? 'Commenti' : 'Commenti di questa pagina'}</span>
        <span className={s.numero}>{elenco.length}</span>
        <button className={s.chiudi} title="Chiudi  esc" aria-label="Chiudi il pannello dei commenti" onClick={onChiudi}>
          <Icona nome="chiudi" />
        </button>
      </header>

      <div className={s.corpo}>
        {elenco.length === 0 && (
          <p className={s.vuoto}>
            Nessun commento qui. Seleziona una frase e premi <b>{scrittaDiComando('commenta')}</b> per lasciartene uno.
          </p>
        )}

        <ul className={s.elenco}>
          {elenco.map((c) => {
            const nelTesto = ordine.includes(c.id)
            return (
              <li key={c.id} className={s.commento}>
                <button className={s.vai} disabled={!nelTesto} onClick={() => vai(c)}>
                  <span className={nelTesto ? s.citazione : `${s.citazione} ${s.persa}`}>
                    «{c.citazione}»
                  </span>
                  <span className={s.testo}>{c.testo}</span>
                </button>
                <div className={s.riga}>
                  <span className={s.data}>
                    {quandoFa(c.modificato ?? c.quando)}
                    {!nelTesto && ' · la frase non c’è più'}
                  </span>
                  <button className={s.risolvi} onClick={() => risolvi(c)}>
                    <Icona nome="accetta" dimensione={12} />Risolvi
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
