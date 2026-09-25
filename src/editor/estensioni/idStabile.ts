import { Extension } from '@tiptap/core'
import { isChangeOrigin } from '@tiptap/extension-collaboration'
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

          /*  Se la modifica arriva da Yjs — un annullamento, o
           *  l'altro dispositivo — gli id ci sono già: li ha scritti
           *  chi ha creato il blocco. Rimetterci le mani qui vuol dire
           *  cambiare il documento nel mezzo del lavoro di y-tiptap,
           *  che subito dopo va a rimettere il cursore dov'era e trova
           *  un documento diverso da quello su cui aveva fatto i
           *  conti: «Position N out of range», e da lì in poi ⌘Z non
           *  risponde più. */
          if (transazioni.some(isChangeOrigin)) return null

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

          /*  Niente `addToHistory: false` qui dentro.
           *
           *  Sembrerebbe giusto — l'id è manutenzione, non una
           *  modifica tua — ma con Yjs quel flag non riguarda solo
           *  questa transazione: y-tiptap lo legge dall'ultima
           *  transazione vista e lo applica all'INTERA transazione
           *  Yjs, che comprende anche la modifica che ha creato il
           *  blocco. Risultato: tutto ciò che crea un blocco — un
           *  Invio, un elenco, un incollamento, una proposta dell'AI —
           *  non finiva nello storico e non si poteva annullare, e
           *  l'undo di quel che restava rimetteva il testo in un
           *  documento diverso da quello che si aspettava. */
          return cambiato ? tr : null
        },
      }),
    ]
  },
})
