import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { segnaCorrezione } from './deposito'
import { trovaCorrezione } from './posto'
import type { Correzione } from './tipi'

/*  «Correggi»: si cambia solo il pezzo che non tornava, e il pezzo nuovo
 *  resta segnato come scritto dalla macchina (dalla lezione in diretta),
 *  come tutto ciò che non hai scritto tu. Grassetto e colori del pezzo
 *  vecchio restano. Si annulla con ⌘Z come qualunque modifica. */

export function accettaCorrezione(editor: Editor, doc: Y.Doc, c: Correzione) {
  const posto = trovaCorrezione(editor.state.doc, c)
  if (!posto) {
    // il pezzo non c'è più: niente da correggere
    segnaCorrezione(doc, c.id, 'ignorata')
    return false
  }
  const segno = editor.schema.marks.segnoAi
  editor.chain().focus(undefined, { scrollIntoView: false }).command(({ tr }) => {
    tr.insertText(posto.sostituto, posto.from, posto.to)
    const inizio = posto.from + (posto.sostituto.length - posto.sostituto.trimStart().length)
    const fine = posto.from + posto.sostituto.trimEnd().length
    if (segno && fine > inizio) tr.addMark(inizio, fine, segno.create({ fonte: 'live', stato: 'accettato' }))
    return true
  }).run()
  segnaCorrezione(doc, c.id, 'accettata')
  return true
}

export function lasciaCorrezione(doc: Y.Doc, c: Correzione) {
  segnaCorrezione(doc, c.id, 'ignorata')
}
