import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { NodoImmagine } from '../immagine/NodoImmagine'
import { inserisciDaFile, inserisciDaCommons } from '../../immagini/inserisci'
import type { Trovata } from '../../immagini/commons'

/** Il tipo MIME con cui il pannello laterale passa un'immagine
 *  all'editor durante il trascinamento. */
export const TIPO_TRASCINAMENTO = 'application/x-pergamena-immagine'

/*  Dove cade davvero un'immagine trascinata.
 *
 *  `posAtCoords` restituisce il punto esatto sotto al puntatore, che
 *  di solito è in mezzo a un paragrafo: inserire lì un blocco lo
 *  spezza in due e lascia un paragrafo vuoto. L'immagine va invece
 *  agganciata al confine del blocco più vicino — sopra se hai
 *  lasciato la presa nella metà alta, sotto se nella metà bassa. */
function posizioneDiBlocco(view: EditorView, x: number, y: number) {
  const punto = view.posAtCoords({ left: x, top: y })
  if (!punto) return undefined

  const $pos = view.state.doc.resolve(punto.pos)
  if ($pos.depth === 0) return punto.pos

  const profondita = 1
  const inizio = $pos.before(profondita)
  const fine = $pos.after(profondita)

  const dom = view.nodeDOM(inizio)
  const riquadro = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null
  if (!riquadro) return inizio

  return y > riquadro.top + riquadro.height / 2 ? fine : inizio
}

function attributoDati(nome: string, predefinito: unknown) {
  return {
    default: predefinito,
    parseHTML: (el: HTMLElement) => el.getAttribute(`data-${nome}`) ?? predefinito,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs[nome] == null || attrs[nome] === '' ? {} : { [`data-${nome}`]: String(attrs[nome]) },
  }
}

export const Immagine = Node.create({
  name: 'immagine',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      idLocale: attributoDati('idLocale', null),
      url: attributoDati('url', null),
      didascalia: attributoDati('didascalia', ''),
      attribuzione: attributoDati('attribuzione', ''),
      allineamento: attributoDati('allineamento', 'piena'),
      larghezza: {
        default: 100,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-larghezza')) || 100,
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-larghezza': String(attrs.larghezza) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-immagine]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ 'data-immagine': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NodoImmagine)
  },

  addProseMirrorPlugins() {
    const editor = this.editor

    const daiFile = (files: FileList | undefined | null, pos?: number) => {
      const immagini = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!immagini.length) return false
      immagini.forEach((f) => void inserisciDaFile(editor, f, pos))
      return true
    }

    return [
      new Plugin({
        key: new PluginKey('immagineIngresso'),
        props: {
          // incollare un'immagine dagli appunti di sistema
          handlePaste: (_view, event) => daiFile(event.clipboardData?.files),

          handleDrop: (view, event) => {
            const dt = (event as DragEvent).dataTransfer
            if (!dt) return false
            const pos = posizioneDiBlocco(
              view,
              (event as DragEvent).clientX,
              (event as DragEvent).clientY,
            )

            // trascinata dal pannello laterale
            const daPannello = dt.getData(TIPO_TRASCINAMENTO)
            if (daPannello) {
              try {
                void inserisciDaCommons(editor, JSON.parse(daPannello) as Trovata, pos)
                return true
              } catch {
                return false
              }
            }

            // trascinata dal Finder
            return daiFile(dt.files, pos)
          },
        },
      }),
    ]
  },
})
