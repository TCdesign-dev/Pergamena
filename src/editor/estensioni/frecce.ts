import { Extension, textInputRule } from '@tiptap/core'

/*  Le frecce si scrivono e diventano frecce, come su Notion.
 *
 *      ->    →        -->    ⟶  (più lunga)
 *      =>    ⇒        ==>    ⟹
 *      <-    ←        <--    ⟵   (serve uno spazio dopo)
 *      <->   ↔        <-->   ⟷   (serve uno spazio dopo)
 *
 *  Perché le frecce a sinistra vogliono lo spazio: se `<-` si
 *  convertisse subito, digitando `<->` ti ritroveresti `←>` e non
 *  arriveresti mai alla freccia doppia. Quelle a destra — le uniche
 *  che usi davvero — restano istantanee.
 *
 *  Dentro ai blocchi di codice non scatta niente: ProseMirror salta
 *  le regole di input nei nodi marcati come codice. */

type Regola = [RegExp, string]

const REGOLE: Regola[] = [
  // a destra: immediate. Il lookbehind impedisce che `->` scatti
  // dentro `-->` o dentro `<->`.
  [/(?<![-<=])-->$/, '⟶'],
  [/(?<![-<=])->$/, '→'],
  [/(?<!=)==>$/, '⟹'],
  [/(?<![=<])=>$/, '⇒'],

  // a sinistra e doppie: alla pressione dello spazio
  [/<-->\s$/, '⟷ '],
  [/<->\s$/, '↔ '],
  [/<--\s$/, '⟵ '],
  [/<-\s$/, '← '],
]

export const Frecce = Extension.create({
  name: 'frecce',

  addOptions() {
    return { attive: true }
  },

  addInputRules() {
    if (!this.options.attive) return []
    return REGOLE.map(([find, replace]) => textInputRule({ find, replace }))
  },
})
