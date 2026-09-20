import { Extension, InputRule } from '@tiptap/core'
import { avviaRicerca } from '../../immagini/statoPannello'
import { leggiImpostazioni } from '../../impostazioni'

/*  Scrivi !Basilica di Superga! e la ricerca parte nel pannello.
 *
 *  Il testo fra i punti esclamativi NON sparisce: «Basilica di
 *  Superga» è una frase dei tuoi appunti, non un comando. Restano
 *  solo i due punti esclamativi a essere tolti.
 *
 *  Il lookbehind impedisce i falsi allarmi: in «Wow! che bello!» il
 *  primo ! è attaccato a una lettera, quindi non apre niente. */

const SINTASSI = /(?<![^\s])!([^!\n]{2,60})!$/

export const RichiestaImmagine = Extension.create({
  name: 'richiestaImmagine',

  addInputRules() {
    return [
      new InputRule({
        find: SINTASSI,
        handler: ({ state, range, match }) => {
          // spenta dalle impostazioni: `null` lascia il testo com'è
          if (!leggiImpostazioni().sintassiImmagini) return null

          const query = match[1].trim()
          if (query.length < 2) return null

          state.tr.insertText(query, range.from, range.to)
          void avviaRicerca(query, 'sintassi')
          return undefined
        },
      }),
    ]
  },
})
