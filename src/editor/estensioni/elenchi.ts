import { Extension, InputRule } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Fragment, type Node as NodoPM, type NodeType } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

/*  Gli elenchi come li usi prendendo appunti.
 *
 *  Il Tab di base (quello di TipTap) sposta una voce sotto la voce
 *  PRECEDENTE dello stesso elenco. Restavano scoperti due casi:
 *
 *   · la prima voce di un elenco numerato che sta subito sotto un
 *     elenco puntato: nessuna voce precedente, il Tab non faceva
 *     niente e il browser portava il cursore fuori dall'editor, su un
 *     pulsante. Adesso la voce diventa un sottoelenco dell'ultima voce
 *     di sopra — numerato, se era numerato;
 *
 *   · «1. » scritto dentro una voce puntata restava testo: dentro un
 *     elenco ProseMirror non sa avvolgere un paragrafo in un altro
 *     elenco. Adesso l'elenco cambia tipo — e «- » fa il contrario.
 *
 *  E il Tab, dentro l'editor, non esce MAI dall'editor. */

const ELENCHI = ['bulletList', 'orderedList']
const eElenco = (n: NodoPM | null | undefined) => !!n && ELENCHI.includes(n.type.name)

/** Profondità della voce d'elenco che contiene la posizione. */
function profonditaVoce($pos: ReturnType<NodoPM['resolve']>) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'listItem') return d
  }
  return 0
}

/*  Tab sulla prima voce di un elenco che ha un altro elenco sopra:
 *  le voci selezionate vanno in fondo all'ultima voce di quello
 *  sopra. Se lì c'è già un sottoelenco dello stesso tipo si accodano,
 *  altrimenti ne nasce uno nuovo. */
function annidaSottoElencoSopra(editor: Editor): boolean {
  const { state } = editor
  const { $from, $to } = state.selection
  const dVoce = profonditaVoce($from)
  if (!dVoce) return false

  const dElenco = dVoce - 1
  const elenco = $from.node(dElenco)
  if ($from.index(dElenco) !== 0) return false          // ci pensa il Tab di base
  if (dElenco < 1) return false
  const genitore = $from.node(dElenco - 1)
  const indice = $from.index(dElenco - 1)
  if (indice === 0) return false
  const sopra = genitore.child(indice - 1)
  if (!eElenco(sopra)) return false
  const ultima = sopra.lastChild
  if (!ultima || ultima.type.name !== 'listItem') return false

  // quante voci si spostano: fino a quella dove finisce la selezione
  const inizioElenco = $from.before(dElenco)
  const stessoElenco = $to.depth >= dElenco && $to.before(dElenco) === inizioElenco
  const fino = stessoElenco ? $to.index(dElenco) : 0
  const voci: NodoPM[] = []
  for (let i = 0; i <= fino; i++) voci.push(elenco.child(i))
  const misura = voci.reduce((s, v) => s + v.nodeSize, 0)

  // dove vanno: dentro l'ultima voce di sopra, in fondo
  const fineUltima = inizioElenco - 1 - 1                // chiusura di «sopra», poi quella della voce
  const coda = ultima.lastChild
  const tipo = elenco.type as NodeType
  const accoda = !!coda && coda.type === tipo
  const tutte = fino === elenco.childCount - 1
  const dove = accoda ? fineUltima - 1 : fineUltima       // dentro il sottoelenco esistente, o dopo
  // se l'elenco si sposta intero si porta dietro il suo id; se no l'id resta a lui
  const attributi = tutte ? elenco.attrs : { ...elenco.attrs, idBlocco: null }
  const contenuto = accoda ? Fragment.from(voci) : Fragment.from(tipo.create(attributi, voci))
  if (!accoda && !ultima.canReplace(ultima.childCount, ultima.childCount, contenuto)) return false

  const primoContenuto = inizioElenco + 1
  const inizioNuovo = accoda ? dove : dove + 1
  const tr = state.tr
  // prima si toglie (sta DOPO il punto d'arrivo, non lo sposta)
  if (tutte) tr.delete(inizioElenco, inizioElenco + elenco.nodeSize)
  else tr.delete(primoContenuto, primoContenuto + misura)
  tr.insert(dove, contenuto)
  const mappa = (p: number) => inizioNuovo + (p - primoContenuto)
  tr.setSelection(TextSelection.create(tr.doc, mappa($from.pos), stessoElenco ? mappa($to.pos) : mappa($from.pos)))
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

/*  «1. » in una voce puntata, «- » in una numerata: cambia il tipo.
 *  Sulla prima voce cambia tutto l'elenco (è appena nato col Tab);
 *  più in basso lo divide, e da lì in giù diventa dell'altro tipo. */
function cambiaTipo(find: RegExp, verso: 'orderedList' | 'bulletList') {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const $inizio = state.doc.resolve(range.from)
      const d = $inizio.depth
      if (d < 3) return null
      const voce = $inizio.node(d - 1)
      if (voce.type.name !== 'listItem' || $inizio.index(d - 1) !== 0) return null
      const elenco = $inizio.node(d - 2)
      if (!eElenco(elenco) || elenco.type.name === verso) return null

      const tipo = state.schema.nodes[verso]
      const attributi = verso === 'orderedList'
        ? { ...elenco.attrs, start: Number(match[1]) || 1 }
        : { ...elenco.attrs }
      const tr = state.tr
      tr.delete(range.from, range.to)
      const posVoce = $inizio.before(d - 1)
      if ($inizio.index(d - 2) === 0) tr.setNodeMarkup($inizio.before(d - 2), tipo, attributi)
      else tr.split(posVoce, 1, [{ type: tipo, attrs: attributi }])
    },
  })
}

export const Elenchi = Extension.create({
  name: 'elenchi',
  // dopo il Tab di base di TipTap: si interviene solo dove lui rinuncia
  priority: 50,

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => annidaSottoElencoSopra(editor) || true,
      'Shift-Tab': () => true,
    }
  },

  addInputRules() {
    return [
      cambiaTipo(/^(\d+)\.\s$/, 'orderedList'),
      cambiaTipo(/^\s*([-+*])\s$/, 'bulletList'),
    ]
  },
})
