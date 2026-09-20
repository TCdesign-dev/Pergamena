import type { Editor } from '@tiptap/core'
import { salva } from './deposito'
import { scarica, type Trovata } from './commons'
import { esponi } from '../lib/dev'

/** Copia i byte nel deposito e mette il nodo nel documento.
 *  `pos` serve quando l'immagine arriva trascinata: va dove l'hai
 *  lasciata cadere, non in fondo. */
export async function inserisciDaCommons(editor: Editor, t: Trovata, pos?: number) {
  const blob = await scarica(t)
  const misure = await misura(blob)
  const id = await salva(blob, {
    ...misure,
    origine: t.pagina,
    attribuzione: t.autore,
    licenza: t.licenza,
  })
  inserisciNodo(
    editor,
    {
      idLocale: id,
      didascalia: t.titolo,
      attribuzione: `${t.autore} · ${t.licenza}`,
      larghezza: larghezzaIniziale(editor, misure.larghezza),
    },
    pos,
  )
}

export async function inserisciDaFile(editor: Editor, file: File, pos?: number) {
  if (!file.type.startsWith('image/')) return
  const misure = await misura(file)
  const id = await salva(file, { ...misure, origine: '', attribuzione: '', licenza: '' })
  inserisciNodo(
    editor,
    { idLocale: id, didascalia: '', attribuzione: '', larghezza: larghezzaIniziale(editor, misure.larghezza) },
    pos,
  )
}

function inserisciNodo(editor: Editor, attrs: Record<string, unknown>, pos?: number) {
  const contenuto = { type: 'immagine', attrs }
  if (typeof pos === 'number') {
    editor.chain().focus().insertContentAt(pos, contenuto).run()
  } else {
    editor.chain().focus().insertContent(contenuto).run()
  }
}

/*  Un'immagine non viene mai ingrandita oltre la sua risoluzione
 *  vera: portare una foto da 500px a tutta colonna la rende sfocata,
 *  e fra due mesi mentre ripassi non capisci perché. */
function larghezzaIniziale(editor: Editor, larghezzaVera: number) {
  const colonna = editor.view.dom.clientWidth
  if (!colonna || !larghezzaVera) return 100
  return Math.round(Math.min(100, Math.max(25, (larghezzaVera / colonna) * 100)))
}

async function misura(blob: Blob) {
  try {
    const bmp = await createImageBitmap(blob)
    const r = { larghezza: bmp.width, altezza: bmp.height }
    bmp.close()
    return r
  } catch {
    return { larghezza: 0, altezza: 0 }
  }
}

esponi({ immagini: { inserisciDaCommons, inserisciDaFile } })
