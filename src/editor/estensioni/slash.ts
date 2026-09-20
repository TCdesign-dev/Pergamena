import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { filtraVoci, type VoceSlash } from '../menu/vociSlash'
import {
  apriSlash, aggiornaSlash, chiudiSlash, muoviSlash, scegliSlash, leggiSlash,
} from '../menu/statoSlash'

/*  Premendo «/» compare l'elenco dei blocchi.
 *
 *  I tasti li intercetta qui il plugin, non React: frecce e Invio
 *  devono essere consumati prima che ProseMirror li interpreti come
 *  spostamento del cursore o a capo. */

export const Slash = Extension.create({
  name: 'slash',

  addProseMirrorPlugins() {
    return [
      Suggestion<VoceSlash, VoceSlash>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,

        items: ({ query }) => filtraVoci(query),

        command: ({ editor, range, props }) => props.azione(editor, range),

        render: () => ({
          onStart: (p) =>
            apriSlash({
              voci: p.items,
              rect: p.clientRect?.() ?? null,
              editor: p.editor,
              range: p.range,
              esegui: p.command,
            }),

          onUpdate: (p) =>
            aggiornaSlash({
              voci: p.items,
              rect: p.clientRect?.() ?? null,
              range: p.range,
              esegui: p.command,
              indice: 0,
            }),

          onKeyDown: ({ event }) => {
            const s = leggiSlash()
            if (!s.aperto || s.voci.length === 0) return false

            switch (event.key) {
              case 'ArrowDown': return muoviSlash(1)
              case 'ArrowUp': return muoviSlash(-1)
              case 'Enter':
              case 'Tab': return scegliSlash()
              case 'Escape': chiudiSlash(); return true
              default: return false
            }
          },

          onExit: () => chiudiSlash(),
        }),
      }),
    ]
  },
})
