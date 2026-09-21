import type { Editor } from '@tiptap/core'
import type { Node as NodoPM } from '@tiptap/pm/model'

export type Proposta = {
  dopo: string
  tipo: 'integra' | 'correggi'
  testo: string
  perche: string
  importanza: number
}

/** Dove sta, adesso, il blocco di primo livello con quell'id. */
function trova(editor: Editor, id: string): { pos: number; nodo: NodoPM } | null {
  let trovato: { pos: number; nodo: NodoPM } | null = null
  editor.state.doc.forEach((nodo, pos) => {
    if (!trovato && nodo.attrs.idBlocco === id) trovato = { pos, nodo }
  })
  return trovato
}

/*  Inserisce le proposte come testo marcato «proposto».
 *
 *  Una proposta prende la forma del posto in cui va: dopo un elenco
 *  diventa una voce di quell'elenco, altrimenti un paragrafo. Un
 *  paragrafo in mezzo a un elenco puntato sarebbe il segno più
 *  evidente che l'ha scritto qualcun altro.
 *
 *  Le posizioni si ricalcolano per ogni proposta, cercando l'id:
 *  ogni inserimento sposta tutto quello che viene dopo. */
export function applica(editor: Editor, proposte: Proposta[]) {
  let fatte = 0

  for (const p of proposte) {
    const bersaglio = trova(editor, p.dopo)
    if (!bersaglio) continue

    const testo = (p.tipo === 'correggi' ? '⚠︎ ' : '') + p.testo.trim()
    const segnato = [{
      type: 'text',
      text: testo,
      marks: [{ type: 'segnoAi', attrs: { fonte: 'audio', stato: 'proposto' } }],
    }]

    const { pos, nodo } = bersaglio
    const elenco = nodo.type.name === 'bulletList' || nodo.type.name === 'orderedList'

    const ok = elenco
      // in fondo all'elenco: dentro, prima della sua chiusura
      ? editor.chain().insertContentAt(pos + nodo.nodeSize - 1, {
          type: 'listItem',
          content: [{ type: 'paragraph', content: segnato }],
        }).run()
      : editor.chain().insertContentAt(pos + nodo.nodeSize, {
          type: 'paragraph',
          content: segnato,
        }).run()

    if (ok) fatte++
  }
  return fatte
}

/** Blocchi di primo livello, come li vede il prompt. */
export function blocchiDi(editor: Editor) {
  const tipo = (n: NodoPM) =>
    n.type.name === 'heading' ? `titolo ${n.attrs.level}` :
    n.type.name === 'bulletList' ? 'elenco' :
    n.type.name === 'orderedList' ? 'elenco numerato' :
    n.type.name === 'blockquote' ? 'citazione' :
    n.type.name === 'codeBlock' ? 'codice' :
    n.type.name === 'immagine' ? 'immagine' : 'paragrafo'

  const blocchi: { id: string; tipo: string; testo: string }[] = []
  editor.state.doc.forEach((n) => {
    const id = n.attrs.idBlocco as string | undefined
    if (!id) return
    const testo = n.type.name === 'immagine'
      ? String(n.attrs.didascalia || 'immagine')
      : n.textBetween(0, n.content.size, ' · ', ' ').trim()
    if (testo) blocchi.push({ id, tipo: tipo(n), testo })
  })
  return blocchi
}
