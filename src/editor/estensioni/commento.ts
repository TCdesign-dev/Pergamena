import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { apriCommento, apriNuovoCommento } from '../../commenti/statoScheda'

/*  Il segno di un commento: un id, e basta.
 *
 *  Quello che hai scritto sta nella mappa Yjs dei commenti (vedi
 *  commenti/deposito.ts); qui resta solo il filo che lega il testo
 *  alla nota. Così il commento segue la frase mentre la riscrivi, e
 *  una frase cancellata si porta via il suo segno — la nota resta
 *  nell'elenco, con la citazione di com'era.
 *
 *  Non è esclusivo: si può commentare una parola in grassetto, o
 *  colorata, senza toglierle niente. */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commento: {
      /** attacca il segno di un commento al testo selezionato */
      commenta: (id: string) => ReturnType
    }
  }
}

export const Commento = Mark.create({
  name: 'commento',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-commento'),
        renderHTML: (attrs: Record<string, unknown>) =>
          (attrs.id ? { 'data-commento': attrs.id } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-commento]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      commenta:
        (id) =>
        ({ commands }) =>
          commands.setMark(this.name, { id }),
    }
  },

  addKeyboardShortcuts() {
    return {
      // come su Notion: ⌘⇧M commenta quello che hai selezionato
      'Mod-Shift-m': ({ editor }) => {
        const { from, to } = editor.state.selection
        return apriNuovoCommento(from, to)
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          /*  Un clic sul testo segnato apre la sua scheda. Non si
           *  ferma il clic: il cursore va dove l'hai messo, come
           *  sempre, e la scheda si apre accanto. */
          handleClick(vista, pos) {
            const dentro = vista.state.doc.nodeAt(pos)?.marks ?? []
            const segno = [...dentro, ...vista.state.doc.resolve(pos).marks()]
              .find((m) => m.type.name === 'commento' && m.attrs.id)
            if (segno) apriCommento(segno.attrs.id as string)
            return false
          },
        },
      }),
    ]
  },
})
