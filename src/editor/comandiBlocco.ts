import type { Editor, Range } from '@tiptap/core'
import { tr } from '../lingua/lingua'

/*  I blocchi inseribili col menu `/`.
 *
 *  Sta in un file suo e non dentro al componente perché la stessa
 *  lista servirà anche alla palette ⌘K e, più avanti, ai suggerimenti
 *  dell'AI: aggiungere un blocco deve voler dire aggiungere una riga
 *  qui, non toccare tre file. */

export type ComandoBlocco = {
  chiave: string
  nome: string
  descrizione: string
  segno: string
  /** parole con cui si trova digitando dopo la `/` */
  alias: string[]
  esegui: (editor: Editor, range: Range) => void
}

/** Toglie la `/query` scritta prima di eseguire il comando. */
const pulisci = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

export const COMANDI_BLOCCO: ComandoBlocco[] = [
  {
    chiave: 'testo', nome: tr('Testo'), descrizione: tr('Paragrafo normale'), segno: '¶',
    alias: ['paragrafo', 'normale', 'p'],
    esegui: (e, r) => pulisci(e, r).setParagraph().run(),
  },
  {
    chiave: 'h1', nome: tr('Titolo 1'), descrizione: tr('Apre un argomento'), segno: 'H1',
    alias: ['titolo', 'argomento', 'heading'],
    esegui: (e, r) => pulisci(e, r).setNode('heading', { level: 1 }).run(),
  },
  {
    chiave: 'h2', nome: tr('Titolo 2'), descrizione: tr('Sottotitolo'), segno: 'H2',
    alias: ['titolo', 'sottotitolo', 'heading'],
    esegui: (e, r) => pulisci(e, r).setNode('heading', { level: 2 }).run(),
  },
  {
    chiave: 'h3', nome: tr('Titolo 3'), descrizione: 'Sotto-sottotitolo', segno: 'H3',
    alias: ['titolo', 'heading'],
    esegui: (e, r) => pulisci(e, r).setNode('heading', { level: 3 }).run(),
  },
  {
    chiave: 'ul', nome: tr('Elenco puntato'), descrizione: tr('Tab per annidare'), segno: '•',
    alias: ['lista', 'punti', 'bullet'],
    esegui: (e, r) => pulisci(e, r).toggleBulletList().run(),
  },
  {
    chiave: 'ol', nome: tr('Elenco numerato'), descrizione: tr('Tab per annidare'), segno: '1.',
    alias: ['lista', 'numeri', 'ordinato'],
    esegui: (e, r) => pulisci(e, r).toggleOrderedList().run(),
  },
  {
    chiave: 'quote', nome: tr('Citazione'), descrizione: tr('Testo rientrato'), segno: '❝',
    alias: ['citazione', 'blockquote'],
    esegui: (e, r) => pulisci(e, r).toggleBlockquote().run(),
  },
  {
    chiave: 'code', nome: tr('Blocco di codice'), descrizione: tr('A larghezza fissa'), segno: '‹›',
    alias: ['codice', 'code', 'pre'],
    esegui: (e, r) => pulisci(e, r).toggleCodeBlock().run(),
  },
  {
    chiave: 'hr', nome: tr('Separatore'), descrizione: tr('Linea orizzontale'), segno: '—',
    alias: ['linea', 'divisore', 'hr'],
    esegui: (e, r) => pulisci(e, r).setHorizontalRule().run(),
  },
]

/** Ricerca tollerante: cerca nel nome e negli alias, senza accenti. */
export function filtraComandi(query: string): ComandoBlocco[] {
  const q = normalizza(query)
  if (!q) return COMANDI_BLOCCO
  return COMANDI_BLOCCO.filter((c) =>
    [c.nome, ...c.alias].some((s) => normalizza(s).includes(q)),
  )
}

export function normalizza(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
