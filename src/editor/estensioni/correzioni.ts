import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as NodoPM } from '@tiptap/pm/model'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import type * as Y from 'yjs'
import { mappaCorrezioni } from '../../correzioni/deposito'
import { postoNelBlocco } from '../../correzioni/posto'
import { Sorveglianza } from '../../correzioni/sorveglianza'
import { apriScheda, iscrivitiScheda, leggiScheda } from '../../correzioni/statoScheda'
import { vaiAllaSegnalazione } from '../../correzioni/naviga'
import type { Correzione } from '../../correzioni/tipi'
import { esponi } from '../../lib/dev'
import { tr } from '../../lingua/lingua'

/*  Le correzioni in diretta, dentro all'editor. Tre cose:
 *
 *   · le fa VEDERE: il pezzo che non torna sottolineato in arancio, e
 *     un pallino nel margine dell'AI, all'altezza della sua riga. Sono
 *     decorazioni, non testo: il documento resta esattamente come l'hai
 *     scritto finché non scegli tu «Correggi»;
 *   · ⌥⌘↓ e ⌥⌘↑ vanno alla segnalazione dopo e a quella prima (⌥↓ da
 *     solo no: su Mac porta a fine paragrafo, e serve a chi scrive);
 *   · dice al sorvegliante quali righe stai scrivendo. Solo le modifiche
 *     tue: quelle che arrivano dalla sincronizzazione non contano. */

type Stato = { decorazioni: DecorationSet; locale: boolean }
export const chiaveCorrezioni = new PluginKey<Stato>('correzioni')

/*  Il pallino è un widget subito dopo il pezzo che non torna, tolto dal
 *  flusso: in verticale resta dove sarebbe stato, cioè sulla riga del
 *  pezzo; in orizzontale va nel margine a destra della colonna. */
function pallino(id: string) {
  const el = document.createElement('span')
  el.className = 'correzione-pallino'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', tr('Correzione dalla lezione (⌥⌘↓)'))
  el.title = tr('Il professore ha detto un’altra cosa  ⌥⌘↓')
  el.dataset.id = id
  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    apriScheda(id)
  })
  return el
}

/** Il pallino della scheda aperta ha l'alone. Si segna sul DOM: rifare
 *  il widget lo farebbe riapparire con la sua animazione. */
function segnaAttivo(dom: HTMLElement) {
  const id = leggiScheda()?.id
  dom.querySelectorAll<HTMLElement>('.correzione-pallino').forEach((el) => el.classList.toggle('attivo', el.dataset.id === id))
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
        title: tr('Il professore: «{detto}»', { detto: c.detto }),
      }))
      // subito dopo il pezzo, attaccato a lui: se la riga va a capo lì, resta sulla sua
      decorazioni.push(Decoration.widget(posto.sottolinea[1], () => pallino(c.id), {
        side: -1,
        key: `correzione:${c.id}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }))
    }
    if (quante) decorazioni.push(Decoration.node(pos, pos + nodo.nodeSize, { class: 'ha-correzione' }))
    return false
  })
  return DecorationSet.create(doc, decorazioni)
}

export const Correzioni = Extension.create<{ doc: Y.Doc | null; documentoId: string | null }>({
  name: 'correzioni',

  addOptions() {
    return { doc: null, documentoId: null }
  },

  addKeyboardShortcuts() {
    const { doc } = this.options
    return {
      'Mod-Alt-ArrowDown': () => !!doc && vaiAllaSegnalazione(this.editor, doc, 1),
      'Mod-Alt-ArrowUp': () => !!doc && vaiAllaSegnalazione(this.editor, doc, -1),
    }
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
          const smettiScheda = iscrivitiScheda(() => segnaAttivo(view.dom))
          const sorveglianza = documentoId ? new Sorveglianza(view, doc, documentoId) : null
          if (sorveglianza) esponi({ sorveglianza })
          return {
            update: (v) => {
              segnaAttivo(v.dom)
              if (chiaveCorrezioni.getState(v.state)?.locale) sorveglianza?.toccata()
            },
            destroy: () => {
              window.clearTimeout(timer)
              mappa.unobserve(ridisegna)
              smettiScheda()
              sorveglianza?.chiudi()
            },
          }
        },
      }),
    ]
  },
})
