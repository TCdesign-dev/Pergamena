import { useEffect, useReducer, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import type { Registrazione } from '../registrazione/tipi'
import { iscrivitiStatoCorrezioni, leggiStatoCorrezioni } from './statoCorrezioni'
import { mappaCorrezioni } from './deposito'
import { mostraSegnalazione, segnalazioni } from './naviga'
import s from './RiepilogoCorrezioni.module.css'

/*  Nel pannello delle lezioni, due cose delle correzioni in diretta.
 *  In cima quelle a cui non hai ancora risposto: in classe si ignora il
 *  pallino e si va avanti, e qui le ritrovi. In fondo quanto hanno
 *  lavorato in questa lezione, e perché si sono fermate, se si sono
 *  fermate. */

function centesimi(dollari: number) {
  const c = dollari * 100
  return c < 0.01 ? 'meno di 0,01 cent' : `${c.toLocaleString('it-IT', { maximumFractionDigits: 2 })} cent`
}

/** Si ridisegna quando cambiano le correzioni della pagina. */
function useCorrezioni(doc: Y.Doc) {
  const [, ridisegna] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const mappa = mappaCorrezioni(doc)
    mappa.observe(ridisegna)
    return () => mappa.unobserve(ridisegna)
  }, [doc])
}

/** «Una correzione aspetta una risposta» + Vedi ⌥⌘↓. */
export function CorrezioniInAttesa({ doc, rifEditore, onVai }: {
  doc: Y.Doc
  rifEditore: RifEditore
  /** prima di andare alla segnalazione: la tendina si chiude */
  onVai: () => void
}) {
  useCorrezioni(doc)
  const editor = rifEditore.current
  const tutte = editor ? segnalazioni(editor, doc) : []
  if (!editor || !tutte.length) return null

  return (
    <div className={s.attesa} role="status">
      <span className={s.pallino} aria-hidden />
      <span className={s.testo}>
        {tutte.length === 1 ? 'Una correzione aspetta' : `${tutte.length} correzioni aspettano`} una risposta
      </span>
      <button className={s.vedi} onClick={() => { onVai(); mostraSegnalazione(editor, tutte[0].c.id) }}>
        Vedi <kbd className={s.tasto}>⌥⌘↓</kbd>
      </button>
    </div>
  )
}

/** Quanto hanno lavorato in questa lezione, e l'ultimo intoppo. */
export function ContiCorrezioni({ lezioni }: { lezioni: Registrazione[] }) {
  const stato = useSyncExternalStore(iscrivitiStatoCorrezioni, leggiStatoCorrezioni)
  const qui = stato.registrazione !== null && lezioni.some((l) => l.id === stato.registrazione)
  if (!qui && !stato.fermo) return null

  return (
    <div className={s.conti}>
      {qui && (
        <p>
          Correzioni in questa lezione: {stato.controlli} {stato.controlli === 1 ? 'controllo' : 'controlli'} ·{' '}
          {stato.proposte} {stato.proposte === 1 ? 'segnalazione' : 'segnalazioni'} · {centesimi(stato.costo)}
        </p>
      )}
      {stato.fermo === 'credito' && (
        <p className={s.fermo}>Correzioni ferme: il credito di OpenRouter è finito. Dopo averlo aggiunto, ricarica la pagina.</p>
      )}
      {stato.errore && !stato.fermo && qui && (
        <p className={s.fermo}>Ultimo intoppo: {stato.errore}. Riprovo da solo.</p>
      )}
    </div>
  )
}
