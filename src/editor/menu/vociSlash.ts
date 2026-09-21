import type { Editor, Range } from '@tiptap/core'
import { normalizza } from '../../lib/testo'
import { nuovaFormula } from '../estensioni/formule'

export type VoceSlash = {
  chiave: string
  nome: string
  suggerimento: string          // la scorciatoia markdown equivalente
  parole: string[]              // sinonimi per la ricerca
  icona: string
  azione: (editor: Editor, range: Range) => void
}

const c = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

export const VOCI_SLASH: VoceSlash[] = [
  { chiave: 'p', nome: 'Testo', suggerimento: '', icona: '¶', parole: ['paragrafo', 'normale'],
    azione: (e, r) => c(e, r).setParagraph().run() },
  { chiave: 'h1', nome: 'Titolo 1', suggerimento: '#', icona: 'H₁', parole: ['argomento', 'titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 1 }).run() },
  { chiave: 'h2', nome: 'Titolo 2', suggerimento: '##', icona: 'H₂', parole: ['sottotitolo', 'titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 2 }).run() },
  { chiave: 'h3', nome: 'Titolo 3', suggerimento: '###', icona: 'H₃', parole: ['titolo'],
    azione: (e, r) => c(e, r).setNode('heading', { level: 3 }).run() },
  { chiave: 'ul', nome: 'Elenco puntato', suggerimento: '-', icona: '•', parole: ['lista', 'punti'],
    azione: (e, r) => c(e, r).toggleBulletList().run() },
  { chiave: 'ol', nome: 'Elenco numerato', suggerimento: '1.', icona: '1.', parole: ['lista', 'numeri'],
    azione: (e, r) => c(e, r).toggleOrderedList().run() },
  { chiave: 'quote', nome: 'Citazione', suggerimento: '>', icona: '❝', parole: ['blocco', 'virgolette'],
    azione: (e, r) => c(e, r).toggleBlockquote().run() },
  { chiave: 'code', nome: 'Blocco di codice', suggerimento: '```', icona: '‹›', parole: ['codice', 'formula'],
    azione: (e, r) => c(e, r).toggleCodeBlock().run() },
  { chiave: 'formula', nome: 'Formula', suggerimento: '$$$', icona: '∑', parole: ['latex', 'math', 'matematica', 'equazione'],
    azione: (e, r) => { c(e, r).run(); nuovaFormula(e, 'blocco') } },
  { chiave: 'fx', nome: 'Formula nel testo', suggerimento: '$$', icona: 'ƒ', parole: ['latex', 'math', 'inline', 'equazione'],
    azione: (e, r) => { c(e, r).run(); nuovaFormula(e, 'inline') } },
  { chiave: 'hr', nome: 'Separatore', suggerimento: '---', icona: '—', parole: ['riga', 'linea', 'divisore'],
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
