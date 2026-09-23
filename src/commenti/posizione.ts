import type { Editor } from '@tiptap/core'

/*  Dove sta, adesso, il pezzo commentato.
 *
 *  Il commento sta nella mappa Yjs, il testo nel documento: a tenerli
 *  insieme è l'id, scritto nel segno. Cercarlo ogni volta invece di
 *  salvare una posizione è l'unico modo perché il commento resti
 *  attaccato alla sua frase mentre scrivi sopra, sotto e in mezzo. */

export type Tratto = { da: number; a: number }

/** Il tratto segnato con quell'id, se c'è ancora. */
export function trattoDi(editor: Editor, id: string): Tratto | null {
  let tratto: Tratto | null = null
  editor.state.doc.descendants((nodo, pos) => {
    if (!nodo.isText) return true
    if (!nodo.marks.some((m) => m.type.name === 'commento' && m.attrs.id === id)) return false
    // i pezzi attaccati sono lo stesso commento, spezzato dal grassetto
    const fine = pos + nodo.nodeSize
    if (tratto && tratto.a === pos) tratto.a = fine
    else if (!tratto) tratto = { da: pos, a: fine }
    return false
  })
  return tratto
}

/** L'elemento nella pagina, per attaccarci la scheda. */
export function elementoDi(editor: Editor, id: string): HTMLElement | null {
  return editor.view.dom.querySelector<HTMLElement>(`[data-commento="${CSS.escape(id)}"]`)
}

/** Gli id dei commenti che stanno ancora nel testo, in ordine di pagina. */
export function commentiInPagina(editor: Editor): string[] {
  const visti: string[] = []
  editor.state.doc.descendants((nodo) => {
    if (!nodo.isText) return true
    for (const m of nodo.marks) {
      const id = m.type.name === 'commento' ? (m.attrs.id as string) : null
      if (id && !visti.includes(id)) visti.push(id)
    }
    return false
  })
  return visti
}

/** Il testo del tratto: la citazione da salvare col commento. */
export function testoDi(editor: Editor, { da, a }: Tratto) {
  return editor.state.doc.textBetween(da, a, ' ', ' ').trim()
}

/** L'id del blocco di primo livello che contiene il tratto. */
export function bloccoDi(editor: Editor, da: number): string | null {
  const $da = editor.state.doc.resolve(da)
  return ($da.depth >= 1 ? ($da.node(1).attrs.idBlocco as string | undefined) : undefined) ?? null
}

export function segnaTratto(editor: Editor, { da, a }: Tratto, id: string) {
  return editor.chain().setTextSelection({ from: da, to: a }).setMark('commento', { id }).run()
}

/** Toglie il segno dal testo: il commento risolto non lascia tracce. */
export function togliSegno(editor: Editor, id: string) {
  const tratto = trattoDi(editor, id)
  if (!tratto) return
  const tipo = editor.schema.marks.commento
  editor.view.dispatch(editor.state.tr.removeMark(tratto.da, tratto.a, tipo))
}
