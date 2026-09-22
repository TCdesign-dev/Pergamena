import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { NodeRange, isNodeRangeSelection } from '@tiptap/extension-node-range'
import type { ResolvedPos } from '@tiptap/pm/model'

/*  Spostare i blocchi, come su Notion.
 *
 *  Col mouse c'è la maniglia (icona «sposta») a sinistra di ogni riga (Editor.tsx);
 *  da tastiera ⌘⇧↑ e ⌘⇧↓ spostano di un posto il blocco dove sta il
 *  cursore — o tutti quelli toccati dalla selezione, o il gruppo scelto
 *  tenendo premuto ⌘ mentre si seleziona col mouse. Dentro un elenco si
 *  sposta la voce fra le sue sorelle; fuori, il blocco fra i blocchi.
 *
 *  Si toglie di mezzo il VICINO e lo si rimette dall'altra parte: i
 *  blocchi spostati non vengono mai cancellati, e tengono il loro id
 *  (àncore delle lezioni, immagini, argomenti restano attaccati). */

/** La profondità del blocco da spostare: la voce d'elenco più interna,
 *  altrimenti il blocco di primo livello. */
function profondita($pos: ResolvedPos) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'listItem') return d
  }
  return Math.min(1, $pos.depth)
}

function sposta(editor: Editor, verso: -1 | 1): boolean {
  const { state } = editor
  const { selection } = state
  const $from = isNodeRangeSelection(selection) ? state.doc.resolve(selection.from + 1) : selection.$from
  const $to = isNodeRangeSelection(selection) ? state.doc.resolve(selection.to - 1) : selection.$to

  const d = profondita($from)
  if (d < 1) return false
  // il gruppo deve stare sotto lo stesso genitore, se no si sposta solo il primo
  const stesso = $to.depth >= d && $to.before(d) >= $from.before(d) && $to.node(d - 1) === $from.node(d - 1)
  const genitore = $from.node(d - 1)
  const primo = $from.index(d - 1)
  const ultimo = stesso ? $to.index(d - 1) : primo
  const inizio = $from.before(d)
  const fine = stesso ? $to.after(d) : $from.after(d)

  if (verso < 0 && primo === 0) return true              // già in cima: il tasto è consumato
  if (verso > 0 && ultimo === genitore.childCount - 1) return true

  const tr = state.tr
  if (verso < 0) {
    const vicino = genitore.child(primo - 1)
    tr.delete(inizio - vicino.nodeSize, inizio)
    tr.insert(fine - vicino.nodeSize, vicino)
  } else {
    const vicino = genitore.child(ultimo + 1)
    tr.delete(fine, fine + vicino.nodeSize)
    tr.insert(inizio, vicino)
  }
  tr.setSelection(selection.map(tr.doc, tr.mapping))
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export const SpostaBlocchi = Extension.create({
  name: 'spostaBlocchi',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': ({ editor }) => sposta(editor, -1),
      'Mod-Shift-ArrowDown': ({ editor }) => sposta(editor, 1),
    }
  },
})

/*  Il gruppo di blocchi: tenendo premuto ⌘ mentre si seleziona col
 *  mouse si prendono righe intere, che poi si trascinano o si spostano
 *  insieme. Le scorciatoie del pacchetto (⇧↑, ⇧↓, ⌘A) si tolgono: qui
 *  Maiuscolo+frecce seleziona il testo, come sempre. */
export const GruppoDiBlocchi = NodeRange.extend({
  addKeyboardShortcuts() {
    return {}
  },
})

