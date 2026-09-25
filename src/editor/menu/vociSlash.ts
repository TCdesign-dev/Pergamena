import type { Editor, Range } from '@tiptap/core'
import { normalizza } from '../../lib/testo'
import { nuovaFormula } from '../estensioni/formule'
import type { NomeIcona } from '../../lib/Icona'
import { tr } from '../../lingua/lingua'

export type VoceSlash = {
  chiave: string
  nome: string
  suggerimento: string          // la scorciatoia markdown equivalente
  parole: string[]              // sinonimi per la ricerca
  /** un segno tipografico (H₁, •, 1.…) oppure un'icona del set */
  icona: string | { svg: NomeIcona }
  azione: (editor: Editor, range: Range) => void
}

const c = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

export const VOCI_SLASH: VoceSlash[] = [
  { chiave: 'p', nome: tr('Testo'), suggerimento: '', icona: { svg: 'testo' }, parole: ['paragrafo', 'normale'],
    azione: (e, r) => c(e, r).setParagraph().run() },
  { chiave: 'h1', nome: tr('Titolo 1'), suggerimento: '#', icona: 'H₁', parole: ['argomento', 'titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 1 }).run() },
  { chiave: 'h2', nome: tr('Titolo 2'), suggerimento: '##', icona: 'H₂', parole: ['sottotitolo', 'titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 2 }).run() },
  { chiave: 'h3', nome: tr('Titolo 3'), suggerimento: '###', icona: 'H₃', parole: ['titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 3 }).run() },
  { chiave: 'ul', nome: tr('Elenco puntato'), suggerimento: '-', icona: '•', parole: ['lista', 'punti'],
    azione: (e, r) => c(e, r).toggleBulletList().run() },
  { chiave: 'ol', nome: tr('Elenco numerato'), suggerimento: '1.', icona: '1.', parole: ['lista', 'numeri'],
    azione: (e, r) => c(e, r).toggleOrderedList().run() },
  { chiave: 'quote', nome: tr('Citazione'), suggerimento: '>', icona: '❝', parole: ['blocco', 'virgolette'],
    azione: (e, r) => c(e, r).toggleBlockquote().run() },
  { chiave: 'code', nome: tr('Blocco di codice'), suggerimento: '```', icona: '‹›', parole: ['codice', 'formula'],
    azione: (e, r) => c(e, r).toggleCodeBlock().run() },
  { chiave: 'formula', nome: tr('Formula'), suggerimento: '$$$', icona: { svg: 'formula' }, parole: ['latex', 'math', 'matematica', 'equazione'],
    azione: (e, r) => { c(e, r).run(); nuovaFormula(e, 'blocco') } },
  { chiave: 'fx', nome: tr('Formula nel testo'), suggerimento: '$$', icona: { svg: 'formula' }, parole: ['latex', 'math', 'inline', 'equazione'],
    azione: (e, r) => { c(e, r).run(); nuovaFormula(e, 'inline') } },
  { chiave: 'hr', nome: tr('Separatore'), suggerimento: '---', icona: '—', parole: ['riga', 'linea', 'divisore'],
    azione: (e, r) => c(e, r).setHorizontalRule().run() },
]

/*  Si cerca anche per nome corto: «/h1» porta dritto al Titolo 1. Chi
 *  ha proprio quel nome corto viene prima di tutti; «/h» li mostra
 *  tutti e tre. Prima «h1» non trovava niente e il menu spariva. */
export function filtraVoci(query: string): VoceSlash[] {
  const q = normalizza(query.trim())
  if (!q) return VOCI_SLASH
  const esatta = VOCI_SLASH.filter((v) => v.chiave === q)
  const altre = VOCI_SLASH.filter((v) => v.chiave !== q && (
    v.chiave.startsWith(q) ||
    normalizza(v.nome).includes(q) ||
    v.parole.some((p) => normalizza(p).includes(q))
  ))
  return [...esatta, ...altre]
}
