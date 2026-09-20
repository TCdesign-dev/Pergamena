import { useEffect, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { apriDocumento } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { estensioniLettura } from '../editor/estensioni'
import s from './Telefono.module.css'

export function Lettore({ documento }: { documento: Documento }) {
  const voce = useMemo(() => apriDocumento(documento.id), [documento.id])
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    setPronto(false)
    voce.pronto.then(() => vivo && setPronto(true))
    return () => { vivo = false }
  }, [voce])

  if (!pronto) return <p className={s.attesa}>…</p>
  return <Pagina key={documento.id} documento={documento} doc={voce.doc} />
}

function Pagina({ documento, doc }: { documento: Documento; doc: ReturnType<typeof apriDocumento>['doc'] }) {
  const editor = useEditor({
    extensions: estensioniLettura(doc),
    editable: false,
  })

  return (
    <article className={s.lettura}>
      <h1 className={s.titoloPagina}>{documento.titolo || 'Senza titolo'}</h1>
      <EditorContent editor={editor} />
    </article>
  )
}
