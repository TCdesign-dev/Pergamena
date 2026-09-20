import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { nanoid } from 'nanoid'

/*  Dà a ogni blocco un identificativo che NON cambia mai.
 *
 *  È il pezzo su cui si appoggia tutto il resto del progetto:
 *   · le patch dell'AI sanno quale blocco toccare;
 *   · le ancore temporali collegano il minuto della lezione al blocco;
 *   · gli argomenti sono intervalli fra due id;
 *   · le immagini ricordano dove stavano.
 *
 *  Va per forza in fase 0: aggiungerlo dopo significherebbe avere
 *  documenti vecchi senza ancore. */

const TIPI_BLOCCO = [
  'paragraph', 'heading', 'blockquote', 'codeBlock',
  'bulletList', 'orderedList', 'listItem', 'horizontalRule',
]

export const IdStabile = Extension.create({
  name: 'idStabile',

  addOptions() {
    return { tipi: TIPI_BLOCCO }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.tipi,
        attributes: {
          idBlocco: {
            default: null,
            keepOnSplit: false, // un blocco nuovo prende un id nuovo
            parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.idBlocco ? { 'data-id': attrs.idBlocco as string } : {},
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const tipi = new Set<string>(this.options.tipi)

    return [
      new Plugin({
        key: new PluginKey('idStabile'),

        appendTransaction: (transazioni, _prima, dopo) => {
          if (!transazioni.some((t) => t.docChanged)) return null

          const tr = dopo.tr
          const visti = new Set<string>()
          let cambiato = false

          dopo.doc.descendants((nodo, pos) => {
            if (!nodo.isBlock || !tipi.has(nodo.type.name)) return

            const id = nodo.attrs.idBlocco as string | null

            // manca (blocco nuovo) oppure è duplicato (incollato): rigenera
            if (!id || visti.has(id)) {
              const nuovo = nanoid(10)
              tr.setNodeAttribute(pos, 'idBlocco', nuovo)
              visti.add(nuovo)
              cambiato = true
            } else {
              visti.add(id)
            }
          })

          return cambiato ? tr.setMeta('addToHistory', false) : null
        },
      }),
    ]
  },
})
