import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { Node as NodoPM } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { RifEditore } from '../editor/Editor'
import { avviaRevisione, chiudiRevisione, iscrivitiRevisione, revisioneAttiva } from './statoRevisione'
import { Icona } from '../lib/Icona'
import s from './Revisione.module.css'
import { tr } from '../lingua/lingua'
import { Tr } from '../lingua/Tr'

/*  La revisione delle proposte del merge.
 *
 *  Due cose che si guardano: la barra in basso, centrata sulla colonna,
 *  con il conto e tutte le azioni cliccabili; e, sopra ogni proposta
 *  che sfiori col mouse (o su quella corrente), una piccola superficie
 *  con Accetta e Rifiuta. La proposta corrente ha un anello azzurro. */

type Proposta = { da: number; a: number }

/*  Tutti i tratti proposti dall'AI, un tratto per blocco.
 *
 *  Non solo testo: una proposta può contenere una formula, che è un
 *  nodo a sé. Se la si saltasse, la proposta si spezzerebbe in due —
 *  e «Rifiuta» ne toglierebbe metà, lasciando la formula orfana. */
function trovaProposte(editor: Editor): Proposta[] {
  const elenco: Proposta[] = []
  editor.state.doc.descendants((nodo, pos) => {
    if (!nodo.isInline) return true
    const segno = nodo.marks.find((m) => m.type.name === 'segnoAi' && m.attrs.stato === 'proposto')
    if (!segno) return false
    const ultimo = elenco[elenco.length - 1]
    // attaccato al precedente: stesso blocco, stessa proposta
    if (ultimo && ultimo.a === pos) ultimo.a = pos + nodo.nodeSize
    else elenco.push({ da: pos, a: pos + nodo.nodeSize })
    return false
  })
  return elenco
}

function accetta(editor: Editor, p: Proposta) {
  const tipo = editor.schema.marks.segnoAi
  const tr = editor.state.tr
  tr.removeMark(p.da, p.a, tipo)
  tr.addMark(p.da, p.a, tipo.create({ fonte: 'audio', stato: 'accettato' }))
  editor.view.dispatch(tr)
}

/*  Una proposta che riempie tutta la riga se ne va con la riga; un
 *  completamento — il pezzo attaccato in fondo, o dentro, a una riga
 *  TUA — se ne va da solo, e quello che hai scritto resta dov'era. */
function riempieLaRiga(doc: NodoPM, p: Proposta) {
  const $da = doc.resolve(Math.min(p.da, doc.content.size))
  return $da.depth > 0 && p.da <= $da.start($da.depth) && p.a >= $da.end($da.depth)
}

function rifiuta(editor: Editor, p: Proposta) {
  if (!riempieLaRiga(editor.state.doc, p)) {
    editor.view.dispatch(editor.state.tr.delete(p.da, p.a))
    return
  }
  const $da = editor.state.doc.resolve(p.da)
  // il paragrafo che contiene la proposta — o la voce d'elenco intera
  let livello = $da.depth
  if (livello > 1 && $da.node(livello - 1).type.name === 'listItem') livello--
  editor.view.dispatch(editor.state.tr.delete($da.before(livello), $da.after(livello)))
}

function mostra(editor: Editor, p: Proposta) {
  editor.chain().setTextSelection({ from: p.da, to: p.a }).run()
  const dom = editor.view.domAtPos(p.da).node
  const el = dom instanceof HTMLElement ? dom : dom.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/*  L'anello azzurro sulla proposta corrente: una decorazione, non un
 *  segno nel testo, così le posizioni si spostano da sole quando
 *  scrivi. Sta intorno al BLOCCO — il paragrafo o la voce d'elenco,
 *  quello che «Rifiuta» toglierebbe — perché una proposta con dentro
 *  del grassetto è fatta di più pezzi, e l'anello si spezzerebbe.
 *  Un completamento invece è solo un pezzo della tua riga: lì l'anello
 *  diventa una tinta sul pezzo, che spezzarsi non può. */
const chiaveCorrente = new PluginKey<Proposta | null>('propostaCorrente')
const pluginCorrente = new Plugin<Proposta | null>({
  key: chiaveCorrente,
  state: {
    init: () => null,
    apply(tr, prima) {
      const meta = tr.getMeta(chiaveCorrente)
      if (meta !== undefined) return meta as Proposta | null
      if (!prima || !tr.docChanged) return prima
      return { da: tr.mapping.map(prima.da), a: tr.mapping.map(prima.a) }
    },
  },
  props: {
    decorations(stato) {
      const p = chiaveCorrente.getState(stato)
      if (!p || p.a <= p.da || p.da > stato.doc.content.size) return DecorationSet.empty
      //  un completamento sta dentro a una riga tua: l'anello intorno
      //  al blocco direbbe che la riga è sua. Si tinge solo il pezzo.
      if (!riempieLaRiga(stato.doc, p)) {
        return DecorationSet.create(stato.doc, [
          Decoration.inline(p.da, p.a, { class: 'proposta-corrente-parte' }),
        ])
      }
      const $da = stato.doc.resolve(Math.min(p.da, stato.doc.content.size))
      let livello = $da.depth
      if (livello > 1 && $da.node(livello - 1).type.name === 'listItem') livello--
      if (livello < 1) return DecorationSet.empty
      return DecorationSet.create(stato.doc, [
        Decoration.node($da.before(livello), $da.after(livello), { class: 'proposta-corrente' }),
      ])
    },
  },
})

export function Revisione({ rifEditore }: { rifEditore: RifEditore }) {
  const attiva = useSyncExternalStore(iscrivitiRevisione, revisioneAttiva)
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [indice, setIndice] = useState(0)
  const [sotto, setSotto] = useState<Proposta | null>(null)

  /*  Si riconta a ogni modifica del documento. L'editor però nasce
   *  DOPO questo componente — aspetta che IndexedDB restituisca la
   *  pagina — quindi all'inizio il riferimento è vuoto: si aspetta
   *  che arrivi invece di rinunciare. Senza, ricaricando la pagina le
   *  proposte c'erano ma la revisione non le vedeva. */
  useEffect(() => {
    let editor: Editor | null = null
    let attesa: number | undefined
    const conta = () => { if (editor) setProposte(trovaProposte(editor)) }
    const aggancia = () => {
      editor = rifEditore.current
      if (!editor) { attesa = window.setTimeout(aggancia, 150); return }
      conta()
      editor.on('update', conta)
      editor.registerPlugin(pluginCorrente)
    }
    aggancia()
    return () => {
      window.clearTimeout(attesa)
      editor?.off('update', conta)
      if (editor && !editor.isDestroyed) editor.unregisterPlugin(chiaveCorrente)
    }
  }, [rifEditore])

  const corrente = proposte[Math.min(indice, proposte.length - 1)]

  useEffect(() => {
    if (attiva && !proposte.length) chiudiRevisione()
  }, [attiva, proposte.length])

  useEffect(() => {
    const editor = rifEditore.current
    if (attiva && editor && corrente) mostra(editor, corrente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attiva, indice, proposte.length])

  // l'anello segue la proposta corrente, e sparisce con la revisione
  useEffect(() => {
    const editor = rifEditore.current
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(editor.state.tr.setMeta(chiaveCorrente, attiva && corrente ? corrente : null))
  }, [rifEditore, attiva, corrente])

  const tasto = useCallback((e: KeyboardEvent) => {
    const editor = rifEditore.current
    if (!editor || !corrente) return

    /*  Si rivede solo finché la selezione è sulla proposta. Se hai
     *  cliccato altrove nel testo stai scrivendo: la revisione si
     *  chiude e il tasto è tuo. Senza questa regola un Invio battuto
     *  per andare a capo diventava un «accetta». */
    const { from, to } = editor.state.selection
    if (from < corrente.da || to > corrente.a) {
      chiudiRevisione()
      return
    }

    const k = e.key.toLowerCase()
    const prendi = () => { e.preventDefault(); e.stopPropagation() }

    if (k === 'escape') { prendi(); chiudiRevisione() }
    else if (k === 'j' || k === 'arrowdown') { prendi(); setIndice((i) => (i + 1) % proposte.length) }
    else if (k === 'k' || k === 'arrowup') { prendi(); setIndice((i) => (i - 1 + proposte.length) % proposte.length) }
    else if (k === 'enter' && (e.metaKey || e.ctrlKey)) { prendi(); accettaTutte() }
    else if (k === 'enter') { prendi(); accetta(editor, corrente) }
    else if (k === 'x' || k === 'backspace') { prendi(); rifiuta(editor, corrente) }
  }, [corrente, proposte, rifEditore])

  useEffect(() => {
    if (!attiva) return
    window.addEventListener('keydown', tasto, true)
    return () => window.removeEventListener('keydown', tasto, true)
  }, [attiva, tasto])

  /*  Col mouse: sfiorando una proposta compaiono le sue azioni. Si
   *  aspetta un attimo prima di toglierle, se no passando dal testo
   *  alla superficie sparirebbero sotto il puntatore. */
  const timerSotto = useRef<number | undefined>(undefined)
  useEffect(() => {
    const editor = rifEditore.current
    if (!editor || editor.isDestroyed || !proposte.length) return
    const dom = editor.view.dom
    const sopra = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-ai][data-stato="proposto"]')
      window.clearTimeout(timerSotto.current)
      if (!el) { timerSotto.current = window.setTimeout(() => setSotto(null), 200); return }
      const pos = editor.view.posAtDOM(el, 0)
      setSotto(proposte.find((p) => pos >= p.da - 1 && pos <= p.a) ?? null)
    }
    const via = () => { window.clearTimeout(timerSotto.current); timerSotto.current = window.setTimeout(() => setSotto(null), 200) }
    dom.addEventListener('mousemove', sopra)
    dom.addEventListener('mouseleave', via)
    return () => {
      window.clearTimeout(timerSotto.current)
      dom.removeEventListener('mousemove', sopra)
      dom.removeEventListener('mouseleave', via)
    }
  }, [rifEditore, proposte])

  function accettaTutte() {
    const editor = rifEditore.current
    if (!editor) return
    ;[...proposte].reverse().forEach((p) => accetta(editor, p))
  }

  if (!proposte.length) return null

  const mostrata = attiva && corrente ? corrente : sotto
  const editor = rifEditore.current

  return (
    <>
      {editor && mostrata && (
        <AzioniProposta
          editor={editor}
          proposta={mostrata}
          onEntra={() => window.clearTimeout(timerSotto.current)}
          onEsci={() => { if (!attiva) setSotto(null) }}
          onAccetta={() => accetta(editor, mostrata)}
          onRifiuta={() => rifiuta(editor, mostrata)}
        />
      )}

      {!attiva ? (
        <button className={s.invito} onClick={() => { setIndice(0); avviaRevisione() }}>
          <Icona nome="ai" dimensione={14} />
          {proposte.length} {proposte.length === 1 ? 'proposta' : 'proposte'} dalla lezione · rivedi
        </button>
      ) : (
        <div className={s.barra} role="toolbar" aria-label={tr('Revisione delle proposte')}>
          <span className={s.conto}>
            <Icona nome="ai" dimensione={14} className={s.scintilla} />
            <b>{Math.min(indice, proposte.length - 1) + 1} di {proposte.length}</b>
            <span className={s.quali}>{tr('proposte dalla lezione')}</span>
          </span>
          <button className={s.icona} aria-label={tr('Precedente (K)')} title={tr('Precedente  K')} onClick={() => setIndice((i) => (i - 1 + proposte.length) % proposte.length)}>
            <Icona nome="sinistra" />
          </button>
          <button className={s.icona} aria-label={tr('Successiva (J)')} title={tr('Successiva  J')} onClick={() => setIndice((i) => (i + 1) % proposte.length)}>
            <Icona nome="destra" />
          </button>
          <span className={s.separatore} />
          <button className={s.trasparente} onClick={() => editor && corrente && rifiuta(editor, corrente)}>
            <Tr frase="Rifiuta <kbd>X</kbd>" classi={{ kbd: s.tasto }} />
          </button>
          <button className={s.secondario} onClick={() => editor && corrente && accetta(editor, corrente)}>
            <Tr frase="Accetta <kbd>↵</kbd>" classi={{ kbd: s.tasto }} />
          </button>
          <button className={s.principale} onClick={accettaTutte}>
            Accetta tutte <kbd className={s.tasto}>⌘↵</kbd>
          </button>
          <button className={s.icona} aria-label={tr('Chiudi la revisione (Esc)')} title={tr('Chiudi  esc')} onClick={chiudiRevisione}>
            <Icona nome="chiudi" />
          </button>
        </div>
      )}
    </>
  )
}

/** Le azioni sopra la proposta: da dove viene, accetta, rifiuta. */
function AzioniProposta({ editor, proposta, onEntra, onEsci, onAccetta, onRifiuta }: {
  editor: Editor
  proposta: Proposta
  onEntra: () => void
  onEsci: () => void
  onAccetta: () => void
  onRifiuta: () => void
}) {
  const rif = useRef<HTMLDivElement>(null)
  const [dove, setDove] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const posiziona = () => {
      const el = rif.current
      if (!el || editor.isDestroyed) return
      let riga
      try { riga = editor.view.coordsAtPos(proposta.da) } catch { return }
      const largo = el.offsetWidth
      const alto = el.offsetHeight
      setDove({
        top: Math.max(8, riga.top - alto - 6),
        left: Math.min(Math.max(8, riga.left - 6), window.innerWidth - largo - 8),
      })
    }
    posiziona()
    window.addEventListener('scroll', posiziona, true)
    window.addEventListener('resize', posiziona)
    return () => {
      window.removeEventListener('scroll', posiziona, true)
      window.removeEventListener('resize', posiziona)
    }
  }, [editor, proposta])

  return (
    <div
      ref={rif}
      className={s.azioni}
      style={dove ?? { visibility: 'hidden' }}
      onMouseEnter={onEntra}
      onMouseLeave={onEsci}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className={s.fonte}>
        <Icona nome="ai" dimensione={14} />
        {tr('Dalla lezione')}
      </span>
      <button className={s.accetta} onClick={onAccetta}>
        <Icona nome="accetta" dimensione={14} />
        {tr('Accetta')}
      </button>
      <button className={s.rifiuta} onClick={onRifiuta}>
        <Icona nome="chiudi" dimensione={14} />
        {tr('Rifiuta')}
      </button>
    </div>
  )
}
