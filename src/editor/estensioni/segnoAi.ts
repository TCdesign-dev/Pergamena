import { Mark, mergeAttributes } from '@tiptap/core'

/*  Marca il testo che non hai scritto tu.
 *
 *  `fonte`  da dove viene:  audio (merge post-lezione)
 *                           live  (correzione dalla trascrizione in diretta)
 *                           manuale (l'hai chiesto tu)
 *  `stato`  proposto → in attesa che tu accetti o rifiuti
 *           accettato → è entrato negli appunti, ma resta riconoscibile
 *
 *  Il segno non sparisce quando accetti: fra due mesi, mentre ripassi,
 *  devi poter vedere a colpo d'occhio cosa ha aggiunto la macchina. */

export type FonteAi = 'audio' | 'live' | 'manuale'
export type StatoAi = 'proposto' | 'accettato'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    segnoAi: {
      segnaComeAi: (fonte: FonteAi) => ReturnType
      accettaAi: () => ReturnType
      rimuoviSegnoAi: () => ReturnType
    }
  }
}

export const SegnoAi = Mark.create({
  name: 'segnoAi',
  inclusive: false,

  addAttributes() {
    return {
      fonte: {
        default: 'audio' as FonteAi,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-fonte') ?? 'audio',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-fonte': attrs.fonte }),
      },
      stato: {
        default: 'proposto' as StatoAi,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-stato') ?? 'proposto',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-stato': attrs.stato }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-ai]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-ai': '' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      segnaComeAi:
        (fonte) =>
        ({ commands }) =>
          commands.setMark(this.name, { fonte, stato: 'proposto' }),

      accettaAi:
        () =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { stato: 'accettato' }),

      rimuoviSegnoAi:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
