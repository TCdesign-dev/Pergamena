import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useEditor, EditorContent, type Editor as EditoreTipTap } from '@tiptap/react'
import { apriDocumento, rinominaDocumento, segnaModificato } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { estensioni } from './estensioni'
import { esponi } from '../lib/dev'
import { MenuSelezione } from './menu/MenuSelezione'
import { MenuSlash } from './menu/MenuSlash'
import { Tessere } from '../layout/Attesa'
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
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    setPronto(false)
    voce.pronto.then(() => vivo && setPronto(true))
    return () => { vivo = false }
  }, [voce])

  if (!pronto) return <div className={s.attesa} aria-busy><Tessere quante={4} /></div>
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
    extensions: estensioni(doc, { segnaposto }),
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

  return (
    <div className={s.tela}>
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
        {editor && <MenuSelezione editor={editor} />}
        <EditorContent editor={editor} />
        <MenuSlash />
      </div>
    </div>
  )
}
