import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { COMANDI, combinazioneDa, combinazioneDi, personalizzate } from '../../tastiera/scorciatoie'
import { apriNuovoCommento } from '../../commenti/statoScheda'
import { COLORI } from '../../stili/colori'
import { sposta } from './spostaBlocchi'

/*  Le scorciatoie dell'editor che hai cambiato tu.
 *
 *  Le scorciatoie di serie restano dove sono, nelle estensioni che le
 *  usano: qui si interviene solo su quelle riassegnate. Due cose, in
 *  quest'ordine:
 *   · il tasto nuovo esegue il comando;
 *   · il tasto vecchio non fa più niente, altrimenti ⌘B continuerebbe
 *     a mettere il grassetto anche dopo averlo spostato altrove.
 *
 *  È un plugin e non `addKeyboardShortcuts` perché le scorciatoie di
 *  TipTap si leggono una volta sola, quando l'editor nasce: cambiarne
 *  una avrebbe voluto dire ricostruire l'editor. Così invece si legge
 *  l'impostazione nel momento in cui premi il tasto. */

type Azione = (editor: Editor) => boolean

const colore = (i: number): Azione => (e) => e.commands.coloraTesto(COLORI[i])
const titolo = (level: 1 | 2 | 3): Azione => (e) => e.chain().focus().toggleHeading({ level }).run()

const AZIONI: Record<string, Azione> = {
  commenta: (e) => {
    const { from, to } = e.state.selection
    return apriNuovoCommento(from, to)
  },
  grassetto: (e) => e.chain().focus().toggleBold().run(),
  corsivo: (e) => e.chain().focus().toggleItalic().run(),
  sottolineato: (e) => e.chain().focus().toggleUnderline().run(),
  codice: (e) => e.chain().focus().toggleCode().run(),
  evidenzia: (e) => e.chain().focus().toggleHighlight().run(),
  titolo1: titolo(1), titolo2: titolo(2), titolo3: titolo(3),
  colore1: colore(0), colore2: colore(1), colore3: colore(2), colore4: colore(3), colore5: colore(4),
  coloreUltimo: (e) => e.commands.coloraConUltimo(),
  scolora: (e) => e.commands.scoloraTesto(),
  spostaSu: (e) => sposta(e, -1),
  spostaGiu: (e) => sposta(e, 1),
}

/** Le combinazioni di serie rimaste orfane: il loro comando sta altrove. */
function orfane(): Set<string> {
  const libere = new Set<string>()
  for (const { comando } of personalizzate()) {
    if (comando.ambito !== 'editor') continue
    // a meno che qualcun altro non ci si sia messo sopra
    if (!COMANDI.some((c) => combinazioneDi(c.id) === comando.predefinita)) libere.add(comando.predefinita)
  }
  return libere
}

export const ScorciatoieUtente = Extension.create({
  name: 'scorciatoieUtente',
  // prima di tutte le altre: deve poter prendere il tasto e fermarlo
  priority: 1000,

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handleKeyDown(_vista, evento) {
            const combinazione = combinazioneDa(evento)
            if (!combinazione) return false

            for (const { comando } of personalizzate()) {
              if (comando.ambito !== 'editor') continue
              if (combinazione !== combinazioneDi(comando.id)) continue
              const azione = AZIONI[comando.id]
              if (!azione) continue
              evento.preventDefault()
              azione(editor)
              return true
            }

            return orfane().has(combinazione)
          },
        },
      }),
    ]
  },
})
