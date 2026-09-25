import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import type * as Y from 'yjs'

import { Annulla } from './annulla'
import { IdStabile } from './idStabile'
import { SegnoAi } from './segnoAi'
import { Commento } from './commento'
import { ScorciatoieUtente } from './scorciatoieUtente'
import { ColoreTesto } from './coloreTesto'
import { Frecce } from './frecce'
import { Slash } from './slash'
import { Immagine } from './immagine'
import { RichiestaImmagine } from './richiestaImmagine'
import { Elenchi } from './elenchi'
import { SpostaBlocchi, GruppoDiBlocchi } from './spostaBlocchi'
import { FormulaASe, FormulaNelTesto, FormuleLettura } from './formule'
import { Correzioni } from './correzioni'
import { tr } from '../../lingua/lingua'

/** L'elenco delle estensioni sta in un posto solo: da qui in poi
 *  aggiungere una funzione all'editor è aggiungere una riga qui. */
export function estensioni(doc: Y.Doc, opzioni: { segnaposto?: string; documentoId?: string } = {}) {
  return [
    StarterKit.configure({
      // l'undo lo gestisce Yjs, non ProseMirror: altrimenti i due
      // storici litigano quando l'AI scrive mentre stai scrivendo tu
      undoRedo: false,
      heading: { levels: [1, 2, 3] },
      // la riga che dice dove cadrà il blocco trascinato
      dropcursor: { color: 'var(--accento)', width: 2 },
    }),
    Highlight.configure({ multicolor: false }),
    Placeholder.configure({
      placeholder: opzioni.segnaposto ?? tr('Scrivi, oppure premi / per i blocchi…'),
    }),
    Annulla,
    IdStabile,
    SegnoAi,
    Commento,
    ScorciatoieUtente,
    ColoreTesto,
    Frecce,
    Elenchi,
    SpostaBlocchi,
    GruppoDiBlocchi.configure({ key: 'Mod' }),
    Slash,
    Immagine,
    RichiestaImmagine,
    FormulaNelTesto,
    FormulaASe,
    Correzioni.configure({ doc, documentoId: opzioni.documentoId ?? null }),
    Collaboration.configure({ document: doc, field: 'contenuto' }),
  ]
}

/*  Sul telefono si legge e basta.
 *
 *  Si riusa lo stesso schema — stesso ProseMirror, stessi nodi — così
 *  una pagina si vede identica a come l'hai scritta sul Mac. Restano
 *  fuori solo le estensioni che servono a SCRIVERE: il menu «/», le
 *  frecce automatiche, la sintassi delle immagini, il segnaposto.
 *  Un renderer statico separato avrebbe voluto dire due schemi da
 *  tenere allineati, e prima o poi due rese diverse. */
export function estensioniLettura(doc: Y.Doc) {
  return [
    StarterKit.configure({ undoRedo: false, heading: { levels: [1, 2, 3] } }),
    Highlight.configure({ multicolor: false }),
    IdStabile,
    SegnoAi,
    Commento,
    ColoreTesto,
    Immagine,
    ...FormuleLettura,
    Collaboration.configure({ document: doc, field: 'contenuto' }),
  ]
}
