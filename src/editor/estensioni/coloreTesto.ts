import { Mark, mergeAttributes } from '@tiptap/core'
import { COLORI, type Colore } from '../../stili/colori'

export { COLORI, ETICHETTE, type Colore } from '../../stili/colori'

/*  Il mark che colora il testo. La tavolozza sta in stili/colori.ts,
 *  condivisa col pallino delle materie.
 *
 *  Scorciatoie:
 *      ⌘⇧C        colora con l'ultimo colore usato
 *      ⌘⇧1…⌘⇧5    colora con quel colore (e diventa l'ultimo usato)
 *      ⌘⇧0        toglie il colore
 *
 *  ⌘⇧1…5 non serve solo per comodità: senza un modo da tastiera per
 *  CAMBIARE l'ultimo colore, ⌘⇧C ti costringerebbe a passare dal menu
 *  ogni volta che cambi colore, e la scorciatoia perderebbe senso. */

const CHIAVE = 'pergamena:ultimo-colore'

export function ultimoColore(): Colore {
  try {
    const v = localStorage.getItem(CHIAVE) as Colore | null
    if (v && COLORI.includes(v)) return v
  } catch { /* finestra privata: si usa il predefinito */ }
  return 'rosso'
}

function ricorda(c: Colore) {
  try { localStorage.setItem(CHIAVE, c) } catch { /* pazienza */ }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    coloreTesto: {
      coloraTesto: (colore: Colore) => ReturnType
      coloraConUltimo: () => ReturnType
      scoloraTesto: () => ReturnType
    }
  }
}

export const ColoreTesto = Mark.create({
  name: 'coloreTesto',

  addAttributes() {
    return {
      nome: {
        default: 'rosso' as Colore,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-colore'),
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-colore': attrs.nome }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-colore]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      coloraTesto:
        (colore) =>
        ({ commands, dispatch }) => {
          // `dispatch` manca nelle prove a vuoto (`can()`): lì non si
          // deve ricordare niente, o basterebbe passarci sopra col
          // mouse per cambiare l'ultimo colore
          if (dispatch) ricorda(colore)
          return commands.setMark(this.name, { nome: colore })
        },

      coloraConUltimo:
        () =>
        ({ commands }) =>
          commands.coloraTesto(ultimoColore()),

      scoloraTesto:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },

  addKeyboardShortcuts() {
    const tasti: Record<string, () => boolean> = {
      'Mod-Shift-c': () => this.editor.commands.coloraConUltimo(),
      'Mod-Shift-0': () => this.editor.commands.scoloraTesto(),
    }
    COLORI.forEach((c, i) => {
      tasti[`Mod-Shift-${i + 1}`] = () => this.editor.commands.coloraTesto(c)
    })
    return tasti
  },
})
