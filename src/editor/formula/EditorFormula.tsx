import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import katex from 'katex'
import { apriFormula, iscrivitiFormula, leggiFormula, type FormulaAperta } from './statoFormula'
import s from './EditorFormula.module.css'

/*  La finestrella della formula: si scrive il LaTeX e sotto si vede
 *  subito com'è. Invio conferma (nel testo; a sé serve ⌘Invio, perché
 *  una formula lunga va su più righe), Esc annulla. Una formula nuova
 *  lasciata vuota sparisce: niente nodi invisibili negli appunti. */

export function EditorFormula({ editor }: { editor: Editor }) {
  const aperta = useSyncExternalStore(iscrivitiFormula, leggiFormula)
  if (!aperta) return null
  return <Finestrella key={`${aperta.tipo}-${aperta.pos}`} editor={editor} formula={aperta} />
}

function Finestrella({ editor, formula }: { editor: Editor; formula: FormulaAperta }) {
  const [latex, setLatex] = useState(formula.latex)
  const [dove, setDove] = useState<{ left: number; top: number } | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  // sotto alla formula, dentro la finestra
  useLayoutEffect(() => {
    const nodo = editor.view.nodeDOM(formula.pos)
    const r = nodo instanceof HTMLElement ? nodo.getBoundingClientRect() : null
    if (!r) return
    const larghezza = 380
    setDove({
      left: Math.max(12, Math.min(r.left, window.innerWidth - larghezza - 12)),
      top: Math.min(r.bottom + 8, window.innerHeight - 220),
    })
  }, [editor, formula.pos])

  // il fuoco nel campo appena la finestrella è al suo posto: prima il
  // campo non c'è ancora, e il fuoco resterebbe nel testo dietro
  const pronta = dove !== null
  useEffect(() => {
    if (pronta) { campo.current?.focus(); campo.current?.select() }
  }, [pronta])

  const anteprima = useMemo(() => {
    if (!latex.trim()) return ''
    return katex.renderToString(latex, { throwOnError: false, displayMode: formula.tipo === 'blocco', strict: false })
  }, [latex, formula.tipo])

  function conferma() {
    const pulito = latex.trim()
    const chain = editor.chain().focus()
    if (!pulito) (formula.tipo === 'inline' ? chain.deleteInlineMath({ pos: formula.pos }) : chain.deleteBlockMath({ pos: formula.pos })).run()
    else (formula.tipo === 'inline' ? chain.updateInlineMath({ latex: pulito, pos: formula.pos }) : chain.updateBlockMath({ latex: pulito, pos: formula.pos })).run()
    apriFormula(null)
  }

  function annulla() {
    // una formula nuova mai scritta non resta
    if (formula.nuova && !formula.latex) {
      const chain = editor.chain().focus()
      ;(formula.tipo === 'inline' ? chain.deleteInlineMath({ pos: formula.pos }) : chain.deleteBlockMath({ pos: formula.pos })).run()
    } else editor.commands.focus()
    apriFormula(null)
  }

  function elimina() {
    const chain = editor.chain().focus()
    ;(formula.tipo === 'inline' ? chain.deleteInlineMath({ pos: formula.pos }) : chain.deleteBlockMath({ pos: formula.pos })).run()
    apriFormula(null)
  }

  if (!dove) return null
  return (
    <div className={s.velo} onMouseDown={annulla}>
      <div
        className={s.finestrella}
        style={{ left: dove.left, top: dove.top }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Formula ${formula.tipo === 'inline' ? 'nel testo' : 'a sé'}`}
      >
        <textarea
          ref={campo}
          className={s.campo}
          value={latex}
          rows={formula.tipo === 'blocco' ? 3 : 1}
          spellCheck={false}
          placeholder={formula.tipo === 'blocco' ? '\\int_0^1 x^2 \\, dx = \\frac{1}{3}' : 'E = mc^2'}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); annulla() }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || formula.tipo === 'inline')) { e.preventDefault(); conferma() }
          }}
        />
        <div
          className={`${s.anteprima} ${formula.tipo === 'blocco' ? s.aSe : ''}`}
          aria-live="polite"
          // katex produce HTML suo, da una formula scritta da te
          dangerouslySetInnerHTML={{ __html: anteprima || '<span class="vuota">l’anteprima compare qui</span>' }}
        />
        <div className={s.piede}>
          <span className={s.aiuto}><kbd className={s.tasto}>esc</kbd> annulla</span>
          <span className={s.azioni}>
            {!formula.nuova && <button className={s.elimina} onClick={elimina}>Elimina</button>}
            <button className={s.fatto} onClick={conferma}>
              Fatto <kbd className={s.tasto}>{formula.tipo === 'inline' ? '↵' : '⌘↵'}</kbd>
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
