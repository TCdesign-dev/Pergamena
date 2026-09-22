import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as NodoPM } from '@tiptap/pm/model'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import type * as Y from 'yjs'
import { mappaCorrezioni } from '../../correzioni/deposito'
import { postoNelBlocco } from '../../correzioni/posto'
import { Sorveglianza } from '../../correzioni/sorveglianza'
import { apriScheda } from '../../correzioni/statoScheda'
import type { Correzione } from '../../correzioni/tipi'
import { esponi } from '../../lib/dev'

/*  Le correzioni in diretta, dentro all'editor. Due cose:
 *
 *   · le fa VEDERE: il pezzo che non torna sottolineato in arancio, e
 *     un pallino nel margine destro della riga. Sono decorazioni, non
 *     testo: il documento resta esattamente come l'hai scritto finché
 *     non scegli tu «Correggi»;
 *   · dice al sorvegliante quali righe stai scrivendo. Solo le modifiche
 *     tue: quelle che arrivano dalla sincronizzazione non contano. */

type Stato = { decorazioni: DecorationSet; locale: boolean }
export const chiaveCorrezioni = new PluginKey<Stato>('correzioni')

function pallino(blocco: string, quante: number) {
  const el = document.createElement('span')
  el.className = 'correzione-pallino'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', quante > 1 ? `${quante} correzioni dalla lezione` : 'Correzione dalla lezione')
  el.title = 'Il professore ha detto un’altra cosa'
  el.dataset.blocco = blocco
  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    apriScheda(blocco, el.getBoundingClientRect())
  })
  return el
}

function decora(doc: NodoPM, mappa: Y.Map<Correzione>) {
  const perBlocco = new Map<string, Correzione[]>()
  mappa.forEach((c) => {
    if (c.stato === 'proposta') perBlocco.set(c.blocco, [...(perBlocco.get(c.blocco) ?? []), c])
  })
  if (!perBlocco.size) return DecorationSet.empty

  const decorazioni: Decoration[] = []
  doc.descendants((nodo, pos) => {
    if (!nodo.isTextblock) return true
    const id = nodo.attrs.idBlocco as string | null
    const lista = id ? perBlocco.get(id) : undefined
    if (!id || !lista) return false
    let quante = 0
    for (const c of lista) {
      const posto = postoNelBlocco(nodo, pos, c)
      if (!posto) continue
      quante++
      decorazioni.push(Decoration.inline(posto.sottolinea[0], posto.sottolinea[1], {
        class: 'correzione-da-vedere',
        title: `Il professore: «${c.detto}»`,
      }))
    }
    if (quante) {
      decorazioni.push(Decoration.node(pos, pos + nodo.nodeSize, { class: 'ha-correzione' }))
      decorazioni.push(Decoration.widget(pos + nodo.nodeSize - 1, () => pallino(id, quante), {
        side: 1,
        key: `correzione:${id}:${quante}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }))
    }
    return false
  })
  return DecorationSet.create(doc, decorazioni)
}

export const Correzioni = Extension.create<{ doc: Y.Doc | null; documentoId: string | null }>({
  name: 'correzioni',

  addOptions() {
    return { doc: null, documentoId: null }
  },

  addProseMirrorPlugins() {
    const { doc, documentoId } = this.options
    if (!doc) return []
    const mappa = mappaCorrezioni(doc)

    return [
      new Plugin<Stato>({
        key: chiaveCorrezioni,
        state: {
          init: (_, stato) => ({ decorazioni: decora(stato.doc, mappa), locale: false }),
          apply: (tr, prima, _vecchio, nuovo) => {
            if (!tr.docChanged && !tr.getMeta(chiaveCorrezioni)) {
              return prima.locale ? { ...prima, locale: false } : prima
            }
            return {
              decorazioni: decora(nuovo.doc, mappa),
              locale: tr.docChanged && !tr.getMeta(ySyncPluginKey)?.isChangeOrigin,
            }
          },
        },
        props: {
          decorations: (stato) => chiaveCorrezioni.getState(stato)?.decorazioni,
        },
        view: (view) => {
          // una correzione arrivata (o accettata altrove): si ridisegna. Non
          // dentro all'osservatore, che può scattare nel mezzo di una
          // sincronizzazione: al giro dopo.
          let timer = 0
          const ridisegna = () => {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => {
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(chiaveCorrezioni, true))
            }, 0)
          }
          mappa.observe(ridisegna)
          const sorveglianza = documentoId ? new Sorveglianza(view, doc, documentoId) : null
          if (sorveglianza) esponi({ sorveglianza })
          return {
            update: (v) => {
              if (chiaveCorrezioni.getState(v.state)?.locale) sorveglianza?.toccata()
            },
            destroy: () => {
              window.clearTimeout(timer)
              mappa.unobserve(ridisegna)
              sorveglianza?.chiudi()
            },
          }
        },
      }),
    ]
  },
})
