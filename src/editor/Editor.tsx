import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useEditor, EditorContent, type Editor as EditoreTipTap } from '@tiptap/react'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { apriDocumento, rinominaDocumento, segnaModificato } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { estensioni } from './estensioni'
import { esponi } from '../lib/dev'
import { MenuSelezione } from './menu/MenuSelezione'
import { MenuSlash } from './menu/MenuSlash'
import { EditorFormula } from './formula/EditorFormula'
import { SchedaCorrezione } from '../correzioni/SchedaCorrezione'
import { iscrivitiNavigazione, prendiMeta } from '../layout/navigazione'
import { Tessere } from '../layout/Attesa'
import { Icona } from '../lib/Icona'
import s from './Editor.module.css'

/** Dove deve andare il cursore quando si apre un documento.
 *  Esplicito e non automatico, perché l'editor non deve rubare il
 *  fuoco a chi sta scrivendo il nome di una materia nella barra. */
export type Fuoco = 'corpo' | 'titolo' | 'niente'

/** Chi sta fuori (la palette ⌘K) deve poter restituire il cursore
 *  all'editor quando si chiude. */
export type RifEditore = RefObject<EditoreTipTap | null>

/** Aspetta che IndexedDB abbia restituito il documento, poi monta
 *  l'editor vero. Il `key` fa sì che cambiando documento si riparta
 *  pulito invece di riciclare uno stato che non c'entra più. */
export function Editor({ documento, fuoco, rifEditore, intestazione, segnaposto }: {
  documento: Documento
  fuoco: Fuoco
  rifEditore: RifEditore
  /** Al posto del titolo della pagina: la scheda della materia ci mette
   *  copertina, nome e campi, nella stessa colonna che scorre. */
  intestazione?: ReactNode
  segnaposto?: string
}) {
  const voce = useMemo(() => apriDocumento(documento.id), [documento.id])
  /*  QUALE documento è pronto, non «se». Con un sì/no, passando a una
   *  pagina non ancora letta da IndexedDB, per un giro valeva ancora il
   *  «pronto» della pagina di prima: l'editor partiva su un documento
   *  vuoto, ci scriveva la sua riga vuota iniziale, e y-indexeddb la
   *  salvava e la fondeva col contenuto vero. Una riga vuota in più, in
   *  cima o in fondo, a ogni pagina aperta dopo un riavvio. */
  const [pronto, setPronto] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    voce.pronto.then(() => vivo && setPronto(documento.id))
    return () => { vivo = false }
  }, [voce, documento.id])

  if (pronto !== documento.id) return <div className={s.attesa} aria-busy><Tessere quante={4} /></div>
  return (
    <Tela
      key={documento.id}
      documento={documento}
      doc={voce.doc}
      fuoco={fuoco}
      rifEditore={rifEditore}
      intestazione={intestazione}
      segnaposto={segnaposto}
    />
  )
}

function Tela({ documento, doc, fuoco, rifEditore, intestazione, segnaposto }: {
  documento: Documento
  doc: ReturnType<typeof apriDocumento>['doc']
  fuoco: Fuoco
  rifEditore: RifEditore
  intestazione?: ReactNode
  segnaposto?: string
}) {
  const timer = useRef<number | undefined>(undefined)
  const rifTitolo = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: estensioni(doc, { segnaposto, documentoId: documento.id }),
    autofocus: fuoco === 'corpo' ? 'end' : false,
    onUpdate: () => {
      // non scriviamo l'indice a ogni battuta
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => segnaModificato(documento.id), 800)
    },
  })

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (fuoco === 'titolo') rifTitolo.current?.focus()
  }, [fuoco])

  useEffect(() => {
    rifEditore.current = editor
    return () => { rifEditore.current = null }
  }, [editor, rifEditore])

  useEffect(() => {
    if (editor) esponi({ editor, doc, documento })
  }, [editor, doc, documento])

  // «rileggi qui» dal quiz o dal ripasso: si va al blocco e lo si fa vedere
  useEffect(() => {
    if (!editor) return
    const mostra = () => {
      const id = prendiMeta(documento.id)
      if (id) window.setTimeout(() => mostraBlocco(editor, id), 80)
    }
    mostra()
    return iscrivitiNavigazione(mostra)
  }, [editor, documento.id])

  return (
    <div className={s.tela} data-scorre>
      <div className={s.colonna}>
        {intestazione ?? <input
          ref={rifTitolo}
          className={s.titolo}
          defaultValue={documento.titolo}
          placeholder="Senza titolo"
          onChange={(e) => rinominaDocumento(documento.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault()
              editor?.chain().focus('start').run()
            }
          }}
        />}
        {editor && <MenuSelezione editor={editor} documentoId={documento.id} />}
        {editor && <Maniglia editor={editor} />}
        {editor && <EditorFormula editor={editor} />}
        {editor && <SchedaCorrezione editor={editor} doc={doc} />}
        <EditorContent editor={editor} />
        <MenuSlash />
      </div>
    </div>
  )
}

/*  La maniglia (icona «sposta») a sinistra della riga sotto il mouse: si trascina per
 *  spostare il blocco (o la voce d'elenco); un clic seleziona il blocco
 *  intero, e da lì ⌘⇧↑/↓ lo sposta o Canc lo toglie. Se c'è già un
 *  gruppo selezionato, trascinandola si sposta tutto il gruppo. */
function Maniglia({ editor }: { editor: EditoreTipTap }) {
  const sotto = useRef<number | null>(null)
  return (
    <DragHandle
      editor={editor}
      nested
      onNodeChange={({ pos }) => { sotto.current = pos }}
    >
      <button
        className={s.maniglia}
        title="Trascina per spostare · clic per selezionare"
        aria-label="Sposta il blocco"
        onClick={() => {
          if (sotto.current !== null && sotto.current >= 0) editor.chain().focus().setNodeSelection(sotto.current).run()
        }}
      >
        <Icona nome="sposta" />
      </button>
    </DragHandle>
  )
}

/** Porta il blocco al centro dello schermo, ci mette il cursore e lo
 *  illumina per un attimo: è lì che bisogna guardare. */
function mostraBlocco(editor: EditoreTipTap, idBlocco: string) {
  let pos = -1
  editor.state.doc.descendants((n, p) => {
    if (pos < 0 && n.attrs?.idBlocco === idBlocco) pos = p
    return pos < 0
  })
  if (pos < 0) return
  const dom = editor.view.nodeDOM(pos)
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ block: 'center', behavior: 'smooth' })
    dom.animate(
      [{ backgroundColor: 'var(--selezione)' }, { backgroundColor: 'transparent' }],
      { duration: 1800, easing: 'ease-out' },
    )
  }
  editor.chain().focus().setTextSelection(pos + 1).run()
}
