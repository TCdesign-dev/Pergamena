import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { apriDocumento } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { estensioniLettura } from '../editor/estensioni'
import s from './Telefono.module.css'

export function Lettore({ documento, titolo, intestazione }: {
  documento: Documento
  titolo?: string
  intestazione?: ReactNode
}) {
  const voce = useMemo(() => apriDocumento(documento.id), [documento.id])
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    setPronto(false)
    voce.pronto.then(() => vivo && setPronto(true))
    return () => { vivo = false }
  }, [voce])

  if (!pronto) return <p className={s.attesa}>…</p>
  return <Pagina key={documento.id} documento={documento} doc={voce.doc} titolo={titolo} intestazione={intestazione} />
}

function Pagina({ documento, doc, titolo, intestazione }: {
  documento: Documento
  doc: ReturnType<typeof apriDocumento>['doc']
  titolo?: string
  intestazione?: ReactNode
}) {
  const editor = useEditor({
    extensions: estensioniLettura(doc),
    editable: false,
  })

  return (
    <article className={s.lettura}>
      <h1 className={s.titoloPagina}>{titolo ?? (documento.titolo || 'Senza titolo')}</h1>
      {intestazione}
      <EditorContent editor={editor} />
    </article>
  )
}
