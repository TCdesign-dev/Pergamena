import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { inAttesa } from './deposito'
import { trovaCorrezione, type Posto } from './posto'
import { apriScheda, leggiScheda } from './statoScheda'
import type { Correzione } from './tipi'

/*  Andare da una segnalazione all'altra: ⌥⌘↓ e ⌥⌘↑ dal testo o dalla
 *  scheda, «vedi» dal pannello Lezioni. Si porta la riga in vista (se
 *  non lo è già) e si apre la sua scheda; il cursore resta dov'era. */

export type Segnalazione = { c: Correzione; posto: Posto }

/** Le correzioni che aspettano e si vedono nel testo, nell'ordine della pagina. */
export function segnalazioni(editor: Editor, doc: Y.Doc): Segnalazione[] {
  return inAttesa(doc)
    .map((c) => ({ c, posto: trovaCorrezione(editor.state.doc, c) }))
    .filter((s): s is Segnalazione => s.posto !== null)
    .sort((a, b) => a.posto.sottolinea[0] - b.posto.sottolinea[0])
}

/** La segnalazione dopo (o prima) di quella aperta; a scheda chiusa,
 *  quella dopo (o prima) del cursore. In fondo si ricomincia da capo. */
export function vaiAllaSegnalazione(editor: Editor, doc: Y.Doc, verso: 1 | -1) {
  const tutte = segnalazioni(editor, doc)
  if (!tutte.length) return false
  const aperta = leggiScheda()
  let i = aperta ? tutte.findIndex((s) => s.c.id === aperta.id) : -1
  if (i >= 0) i = (i + verso + tutte.length) % tutte.length
  else {
    const qui = editor.state.selection.from
    i = verso > 0
      ? tutte.findIndex((s) => s.posto.sottolinea[0] > qui)
      : tutte.length - 1 - [...tutte].reverse().findIndex((s) => s.posto.sottolinea[1] < qui)
    if (i < 0 || i >= tutte.length) i = verso > 0 ? 0 : tutte.length - 1
  }
  mostraSegnalazione(editor, tutte[i].c.id)
  return true
}

/** Porta in vista la riga della segnalazione, lasciando posto sotto
 *  per la scheda, e la apre. */
export function mostraSegnalazione(editor: Editor, id: string) {
  const pallino = pallinoDi(editor, id)
  const tela = pallino?.closest<HTMLElement>('[data-scorre]')
  if (pallino && tela) {
    const riga = pallino.getBoundingClientRect()
    const vista = tela.getBoundingClientRect()
    if (riga.top < vista.top + 64 || riga.bottom > vista.bottom - 280) {
      const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      tela.scrollTo({ top: tela.scrollTop + riga.top - vista.top - vista.height * 0.3, behavior: fermo ? 'auto' : 'smooth' })
    }
  }
  apriScheda(id)
}

/** Il pallino a margine di una segnalazione. */
export function pallinoDi(editor: Editor, id: string) {
  return editor.view.dom.querySelector<HTMLElement>(`.correzione-pallino[data-id="${CSS.escape(id)}"]`)
}
