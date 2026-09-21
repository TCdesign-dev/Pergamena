import { useEffect, useState } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { COLORI, ETICHETTE, type Colore } from '../../stili/colori'
import { ultimoColore } from '../estensioni/coloreTesto'
import { mappaDocumenti, mappaQuaderni } from '../../documento/archivio'
import { apriQuiz } from '../../ripasso/statoQuiz'
import type { BloccoTesto } from '../../ripasso/argomenti'
import s from './MenuSelezione.module.css'

/*  Compare solo quando selezioni del testo.
 *  È il motivo per cui in cima all'app non c'è nessuna barra
 *  degli strumenti: gli strumenti vengono da te, non viceversa. */

type Voce = {
  chiave: string
  etichetta: string
  titolo: string
  attivo: (e: Editor) => boolean
  azione: (e: Editor) => void
  stile?: string
}

const sep = (k: string): Voce => ({
  chiave: `sep-${k}`, etichetta: '', titolo: '', attivo: () => false, azione: () => {},
})

const titolo = (n: 1 | 2 | 3): Voce => ({
  chiave: `h${n}`,
  etichetta: `H${n}`,
  titolo: n === 1 ? 'Titolo — apre un argomento' : `Titolo di livello ${n}`,
  attivo: (e) => e.isActive('heading', { level: n }),
  azione: (e) => e.chain().focus().toggleHeading({ level: n }).run(),
})

const VOCI: Voce[] = [
  { chiave: 'b', etichetta: 'B', titolo: 'Grassetto  ⌘B',
    attivo: (e) => e.isActive('bold'),
    azione: (e) => e.chain().focus().toggleBold().run(), stile: 'grassetto' },
  { chiave: 'i', etichetta: 'I', titolo: 'Corsivo  ⌘I',
    attivo: (e) => e.isActive('italic'),
    azione: (e) => e.chain().focus().toggleItalic().run(), stile: 'corsivo' },
  { chiave: 'u', etichetta: 'U', titolo: 'Sottolineato  ⌘U',
    attivo: (e) => e.isActive('underline'),
    azione: (e) => e.chain().focus().toggleUnderline().run(), stile: 'sottolineato' },
  { chiave: 'ev', etichetta: '▚', titolo: 'Evidenzia  ⌘⇧H',
    attivo: (e) => e.isActive('highlight'),
    azione: (e) => e.chain().focus().toggleHighlight().run() },
  { chiave: 'cd', etichetta: '‹›', titolo: 'Codice  ⌘E',
    attivo: (e) => e.isActive('code'),
    azione: (e) => e.chain().focus().toggleCode().run() },
  sep('a'),
  titolo(1), titolo(2), titolo(3),
  sep('b'),
  { chiave: 'q', etichetta: '❝', titolo: 'Citazione',
    attivo: (e) => e.isActive('blockquote'),
    azione: (e) => e.chain().focus().toggleBlockquote().run() },
  { chiave: 'ul', etichetta: '•', titolo: 'Elenco puntato',
    attivo: (e) => e.isActive('bulletList'),
    azione: (e) => e.chain().focus().toggleBulletList().run() },
  { chiave: 'ol', etichetta: '1.', titolo: 'Elenco numerato',
    attivo: (e) => e.isActive('orderedList'),
    azione: (e) => e.chain().focus().toggleOrderedList().run() },
]

/*  «Quiz» sul passaggio selezionato: le domande nascono solo da lì. Ogni
 *  riga porta l'id del suo blocco, così «rileggi» sa dove tornare. */
function quizSullaSelezione(editor: Editor, documentoId: string) {
  const { from, to } = editor.state.selection
  const blocchi: BloccoTesto[] = []
  editor.state.doc.nodesBetween(from, to, (n, pos) => {
    if (!n.isTextblock) return true
    const testo = editor.state.doc.textBetween(Math.max(from, pos + 1), Math.min(to, pos + n.nodeSize - 1), ' ', ' ').trim()
    const $p = editor.state.doc.resolve(pos + 1)
    const id = (($p.depth >= 1 ? $p.node(1) : n).attrs.idBlocco as string | undefined) ?? null
    if (testo) blocchi.push({ id, tipo: 'paragrafo', testo })
    return false
  })
  if (!blocchi.length) return
  const quadernoId = mappaDocumenti.get(documentoId)?.quadernoId
  apriQuiz({
    tipo: 'selezione',
    titolo: 'Il passaggio selezionato',
    materia: (quadernoId && mappaQuaderni.get(quadernoId)?.nome) || '',
    documentoId,
    blocchi,
  })
}

export function MenuSelezione({ editor, documentoId }: { editor: Editor; documentoId: string }) {
  const [pannello, setPannello] = useState<'principale' | 'colori'>('principale')

  // cambiando selezione si torna sempre al pannello principale
  useEffect(() => {
    const azzera = () => setPannello('principale')
    editor.on('selectionUpdate', azzera)
    return () => { editor.off('selectionUpdate', azzera) }
  }, [editor])

  const coloreAttivo: Colore | null =
    COLORI.find((c) => editor.isActive('coloreTesto', { nome: c })) ?? null

  // la «A» mostra il colore della selezione; se non ne ha, mostra
  // sbiadito quello che applicherebbe ⌘⇧C. Serve a rendere visibile
  // una scorciatoia che altrimenti dovresti ricordare a memoria.
  const coloreMostrato = coloreAttivo ?? ultimoColore()

  return (
    <BubbleMenu
      editor={editor}
      className={s.menu}
      shouldShow={({ editor: e, element, view, state, from, to }) => {
        const { selection } = state
        // formule e immagini hanno la loro finestrella: il menu del testo non serve
        if (selection instanceof NodeSelection && selection.node.isAtom) return false
        const vuoto = !state.doc.textBetween(from, to).length && selection instanceof TextSelection
        const nelMenu = element.contains(document.activeElement)
        return (view.hasFocus() || nelMenu) && !selection.empty && !vuoto && e.isEditable
      }}
    >
      {pannello === 'principale' ? (
        <>
          {VOCI.map((v) =>
            v.chiave.startsWith('sep') ? (
              <span key={v.chiave} className={s.separatore} />
            ) : (
              <button
                key={v.chiave}
                title={v.titolo}
                className={`${s.bottone} ${v.stile ? s[v.stile] : ''} ${
                  v.attivo(editor) ? s.attivo : ''
                }`}
                onClick={() => v.azione(editor)}
              >
                {v.etichetta}
              </button>
            ),
          )}
          <span className={s.separatore} />
          <button
            title={`Colore del testo — ⌘⇧C applica ${ETICHETTE[coloreMostrato]}`}
            className={`${s.bottone} ${s.apriColori} ${coloreAttivo ? s.attivo : ''}`}
            onClick={() => setPannello('colori')}
          >
            <span
              className={s.lettera}
              data-colore={coloreMostrato}
              data-applicato={coloreAttivo ? '' : undefined}
            >
              A
            </span>
            <span className={s.freccetta}>▾</span>
          </button>
          <span className={s.separatore} />
          <button
            title="Un quiz su questo passaggio"
            className={`${s.bottone} ${s.quiz}`}
            onClick={() => quizSullaSelezione(editor, documentoId)}
          >
            Quiz
          </button>
        </>
      ) : (
        <>
          <button
            title="Indietro"
            className={s.bottone}
            onClick={() => setPannello('principale')}
          >
            ‹
          </button>
          <span className={s.separatore} />
          {COLORI.map((c, i) => (
            <button
              key={c}
              title={`${ETICHETTE[c]}  ⌘⇧${i + 1}`}
              className={`${s.bottone} ${s.pastiglia} ${coloreAttivo === c ? s.attivo : ''}`}
              onClick={() => {
                editor.chain().focus().coloraTesto(c).run()
                setPannello('principale')
              }}
            >
              <span className={s.campione} data-colore={c} />
            </button>
          ))}
          <span className={s.separatore} />
          <button
            title="Togli il colore  ⌘⇧0"
            className={s.bottone}
            onClick={() => {
              editor.chain().focus().scoloraTesto().run()
              setPannello('principale')
            }}
          >
            ⨯
          </button>
        </>
      )}
    </BubbleMenu>
  )
}
