import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { RifEditore } from '../editor/Editor'
import { avviaRevisione, chiudiRevisione, iscrivitiRevisione, revisioneAttiva } from './statoRevisione'
import s from './Revisione.module.css'

type Proposta = { da: number; a: number }

/** Tutti i tratti di testo proposti dall'AI, un tratto per blocco. */
function trovaProposte(editor: Editor): Proposta[] {
  const elenco: Proposta[] = []
  editor.state.doc.descendants((nodo, pos) => {
    if (!nodo.isText) return
    const segno = nodo.marks.find((m) => m.type.name === 'segnoAi' && m.attrs.stato === 'proposto')
    if (!segno) return
    const ultimo = elenco[elenco.length - 1]
    // attaccato al precedente: stesso blocco, stessa proposta
    if (ultimo && ultimo.a === pos) ultimo.a = pos + nodo.nodeSize
    else elenco.push({ da: pos, a: pos + nodo.nodeSize })
  })
  return elenco
}

function accetta(editor: Editor, p: Proposta) {
  const tipo = editor.schema.marks.segnoAi
  const tr = editor.state.tr
  tr.removeMark(p.da, p.a, tipo)
  tr.addMark(p.da, p.a, tipo.create({ fonte: 'audio', stato: 'accettato' }))
  editor.view.dispatch(tr)
}

function rifiuta(editor: Editor, p: Proposta) {
  const $da = editor.state.doc.resolve(p.da)
  // il paragrafo che contiene la proposta — o la voce d'elenco intera
  let livello = $da.depth
  if (livello > 1 && $da.node(livello - 1).type.name === 'listItem') livello--
  editor.view.dispatch(editor.state.tr.delete($da.before(livello), $da.after(livello)))
}

function mostra(editor: Editor, p: Proposta) {
  editor.chain().setTextSelection({ from: p.da, to: p.a }).run()
  const dom = editor.view.domAtPos(p.da).node
  const el = dom instanceof HTMLElement ? dom : dom.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function Revisione({ rifEditore }: { rifEditore: RifEditore }) {
  const attiva = useSyncExternalStore(iscrivitiRevisione, revisioneAttiva)
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [indice, setIndice] = useState(0)

  /*  Si riconta a ogni modifica del documento. L'editor però nasce
   *  DOPO questo componente — aspetta che IndexedDB restituisca la
   *  pagina — quindi all'inizio il riferimento è vuoto: si aspetta
   *  che arrivi invece di rinunciare. Senza, ricaricando la pagina le
   *  proposte c'erano ma la revisione non le vedeva. */
  useEffect(() => {
    let editor: Editor | null = null
    let attesa: number | undefined
    const conta = () => { if (editor) setProposte(trovaProposte(editor)) }
    const aggancia = () => {
      editor = rifEditore.current
      if (!editor) { attesa = window.setTimeout(aggancia, 150); return }
      conta()
      editor.on('update', conta)
    }
    aggancia()
    return () => { window.clearTimeout(attesa); editor?.off('update', conta) }
  }, [rifEditore])

  const corrente = proposte[Math.min(indice, proposte.length - 1)]

  useEffect(() => {
    if (attiva && !proposte.length) chiudiRevisione()
  }, [attiva, proposte.length])

  useEffect(() => {
    const editor = rifEditore.current
    if (attiva && editor && corrente) mostra(editor, corrente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attiva, indice, proposte.length])

  const tasto = useCallback((e: KeyboardEvent) => {
    const editor = rifEditore.current
    if (!editor || !corrente) return

    /*  Si rivede solo finché la selezione è sulla proposta. Se hai
     *  cliccato altrove nel testo stai scrivendo: la revisione si
     *  chiude e il tasto è tuo. Senza questa regola un Invio battuto
     *  per andare a capo diventava un «accetta». */
    const { from, to } = editor.state.selection
    if (from < corrente.da || to > corrente.a) {
      chiudiRevisione()
      return
    }

    const k = e.key.toLowerCase()
    const prendi = () => { e.preventDefault(); e.stopPropagation() }

    if (k === 'escape') { prendi(); chiudiRevisione() }
    else if (k === 'j' || k === 'arrowdown') { prendi(); setIndice((i) => (i + 1) % proposte.length) }
    else if (k === 'k' || k === 'arrowup') { prendi(); setIndice((i) => (i - 1 + proposte.length) % proposte.length) }
    else if (k === 'enter' && (e.metaKey || e.ctrlKey)) {
      prendi()
      ;[...proposte].reverse().forEach((p) => accetta(editor, p))
    }
    else if (k === 'enter') { prendi(); accetta(editor, corrente) }
    else if (k === 'x' || k === 'backspace') { prendi(); rifiuta(editor, corrente) }
  }, [corrente, proposte, rifEditore])

  useEffect(() => {
    if (!attiva) return
    window.addEventListener('keydown', tasto, true)
    return () => window.removeEventListener('keydown', tasto, true)
  }, [attiva, tasto])

  if (!proposte.length) return null

  if (!attiva) {
    return (
      <button className={s.invito} onClick={() => { setIndice(0); avviaRevisione() }}>
        {proposte.length} {proposte.length === 1 ? 'proposta' : 'proposte'} dalla lezione · rivedi
      </button>
    )
  }

  return (
    <div className={s.barra} role="toolbar" aria-label="Revisione delle proposte">
      <span className={s.conto}>{Math.min(indice, proposte.length - 1) + 1} di {proposte.length}</span>
      <span className={s.tasti}>
        <kbd>J</kbd><kbd>K</kbd> scorri · <kbd>↵</kbd> accetta · <kbd>X</kbd> rifiuta · <kbd>⌘↵</kbd> tutte · <kbd>esc</kbd>
      </span>
    </div>
  )
}
