import type { Editor, Range } from '@tiptap/core'
import { normalizza } from '../../lib/testo'

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
  { chiave: 'hr', nome: 'Separatore', suggerimento: '---', icona: '—', parole: ['riga', 'linea', 'divisore'],
    azione: (e, r) => c(e, r).setHorizontalRule().run() },
]

export function filtraVoci(query: string): VoceSlash[] {
  const q = normalizza(query.trim())
  if (!q) return VOCI_SLASH
  return VOCI_SLASH.filter((v) =>
    normalizza(v.nome).includes(q) || v.parole.some((p) => normalizza(p).includes(q)),
  )
}
