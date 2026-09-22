import { useEffect, useReducer, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import type { Registrazione } from '../registrazione/tipi'
import { iscrivitiStatoCorrezioni, leggiStatoCorrezioni } from './statoCorrezioni'
import { mappaCorrezioni } from './deposito'
import { mostraSegnalazione, segnalazioni } from './naviga'
import s from './RiepilogoCorrezioni.module.css'

/*  Nel pannello delle lezioni: le correzioni a cui non hai ancora
 *  risposto (in classe si ignora il pallino e si va avanti: qui le
 *  ritrovi), quanto hanno lavorato in questa lezione, e perché si sono
 *  fermate, se si sono fermate. */

function centesimi(dollari: number) {
  const c = dollari * 100
  return c < 0.01 ? 'meno di 0,01 cent' : `${c.toLocaleString('it-IT', { maximumFractionDigits: 2 })} cent`
}

export function RiepilogoCorrezioni({ doc, rifEditore, lezioni, onVai }: {
  doc: Y.Doc
  rifEditore: RifEditore
  lezioni: Registrazione[]
  onVai: () => void
}) {
  const stato = useSyncExternalStore(iscrivitiStatoCorrezioni, leggiStatoCorrezioni)
  const [, ridisegna] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const mappa = mappaCorrezioni(doc)
    mappa.observe(ridisegna)
    return () => mappa.unobserve(ridisegna)
  }, [doc])

  const editor = rifEditore.current
  const inSospeso = editor ? segnalazioni(editor, doc) : []
  const qui = stato.registrazione !== null && lezioni.some((l) => l.id === stato.registrazione)

  if (!inSospeso.length && !qui && !stato.fermo) return null
  return (
    <div className={s.riepilogo}>
      {inSospeso.length > 0 && (
        <p className={s.sospese}>
          <span className={s.pallino} aria-hidden />
          {inSospeso.length === 1 ? 'Una correzione aspetta' : `${inSospeso.length} correzioni aspettano`} una risposta
          <button className={s.vedi} onClick={() => { onVai(); if (editor) mostraSegnalazione(editor, inSospeso[0].c.id) }}>vedi</button>
        </p>
      )}
      {qui && (
        <p className={s.conti}>
          In questa lezione: {stato.controlli} {stato.controlli === 1 ? 'controllo' : 'controlli'} ·{' '}
          {stato.proposte} {stato.proposte === 1 ? 'correzione' : 'correzioni'} · {centesimi(stato.costo)}
        </p>
      )}
      {stato.fermo === 'credito' && (
        <p className={s.fermo}>Correzioni ferme: il credito di OpenRouter è finito. Dopo averlo aggiunto, ricarica la pagina.</p>
      )}
      {stato.errore && !stato.fermo && qui && (
        <p className={s.intoppo}>Ultimo intoppo: {stato.errore}. Riprovo da solo.</p>
      )}
    </div>
  )
}
