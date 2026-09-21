import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'
import type { Editor } from '@tiptap/core'
import { apriFormula } from '../formula/statoFormula'

/*  Le formule, in LaTeX, disegnate da KaTeX.
 *
 *  Si scrivono in tre modi:
 *   · `$$E=mc^2$$` dentro una riga: formula nel testo;
 *   · `$$$…$$$` su una riga da sola: formula a sé, centrata;
 *   · «/formula» dal menu: si apre la finestrella per scriverla.
 *  Un clic su una formula riapre la finestrella. Inline e a sé si
 *  configurano separatamente: la seconda vuole la «displayMode» di
 *  KaTeX (frazioni grandi, sommatorie coi limiti sopra e sotto). */

const KATEX = { throwOnError: false, strict: false } as const

export const FormulaNelTesto = InlineMath.configure({
  katexOptions: { ...KATEX, displayMode: false },
  onClick: (node, pos) => apriFormula({ tipo: 'inline', pos, latex: String(node.attrs.latex ?? ''), nuova: false }),
})

export const FormulaASe = BlockMath.configure({
  katexOptions: { ...KATEX, displayMode: true },
  onClick: (node, pos) => apriFormula({ tipo: 'blocco', pos, latex: String(node.attrs.latex ?? ''), nuova: false }),
})

/** Sul telefono si leggono e basta: niente clic. */
export const FormuleLettura = [
  InlineMath.configure({ katexOptions: { ...KATEX, displayMode: false } }),
  BlockMath.configure({ katexOptions: { ...KATEX, displayMode: true } }),
]

/** Una formula nuova, vuota, dove sta il cursore — e la finestrella per
 *  scriverla. Se la si chiude senza scrivere niente, sparisce. */
export function nuovaFormula(editor: Editor, tipo: 'inline' | 'blocco') {
  const nome = tipo === 'inline' ? 'inlineMath' : 'blockMath'
  const dove = editor.state.selection.from
  editor.chain().focus().insertContent({ type: nome, attrs: { latex: '' } }).run()
  // la formula vuota più vicina a dove stava il cursore: è quella appena messa
  let pos = -1
  editor.state.doc.descendants((n, p) => {
    if (n.type.name === nome && !n.attrs.latex && (pos < 0 || Math.abs(p - dove) < Math.abs(pos - dove))) pos = p
  })
  if (pos >= 0) apriFormula({ tipo, pos, latex: '', nuova: true })
}
