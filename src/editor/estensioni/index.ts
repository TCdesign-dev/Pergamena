import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import type * as Y from 'yjs'

import { IdStabile } from './idStabile'
import { SegnoAi } from './segnoAi'
import { ColoreTesto } from './coloreTesto'
import { Frecce } from './frecce'
import { Slash } from './slash'
import { Immagine } from './immagine'
import { RichiestaImmagine } from './richiestaImmagine'

/** L'elenco delle estensioni sta in un posto solo: da qui in poi
 *  aggiungere una funzione all'editor è aggiungere una riga qui. */
export function estensioni(doc: Y.Doc) {
  return [
    StarterKit.configure({
      // l'undo lo gestisce Yjs, non ProseMirror: altrimenti i due
      // storici litigano quando l'AI scrive mentre stai scrivendo tu
      undoRedo: false,
      heading: { levels: [1, 2, 3] },
    }),
    Highlight.configure({ multicolor: false }),
    Placeholder.configure({
      placeholder: 'Scrivi, oppure premi / per i blocchi…',
    }),
    IdStabile,
    SegnoAi,
    ColoreTesto,
    Frecce,
    Slash,
    Immagine,
    RichiestaImmagine,
    Collaboration.configure({ document: doc, field: 'contenuto' }),
  ]
}
