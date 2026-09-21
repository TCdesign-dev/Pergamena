import type { Editor } from '@tiptap/core'
import type { Node as NodoPM } from '@tiptap/pm/model'
import { daMarcatura, inMarcatura } from './marcatura'

export type Proposta = {
  dopo: string
  tipo: 'integra' | 'correggi'
  testo: string
  perche: string
  importanza: number
}

/** Dove sta, adesso, il blocco di primo livello con quell'id. */
function trova(editor: Editor, id: string): { pos: number; nodo: NodoPM } | null {
  let trovato: { pos: number; nodo: NodoPM } | null = null
  editor.state.doc.forEach((nodo, pos) => {
    if (!trovato && nodo.attrs.idBlocco === id) trovato = { pos, nodo }
  })
  return trovato
}

/*  Inserisce le proposte come testo marcato «proposto».
 *
 *  Una proposta prende la forma del posto in cui va: dopo un elenco
 *  diventa una voce di quell'elenco, altrimenti un paragrafo. Un
 *  paragrafo in mezzo a un elenco puntato sarebbe il segno più
 *  evidente che l'ha scritto qualcun altro.
 *
 *  Le proposte per lo stesso blocco entrano insieme, nell'ordine in
 *  cui le ha scritte il modello. Una alla volta, ognuna finiva subito
 *  sotto al blocco, cioè SOPRA la precedente: uscivano al contrario,
 *  «Seconda parte» prima di «Prima parte».
 *
 *  Le posizioni si ricalcolano per ogni blocco, cercando l'id: ogni
 *  inserimento sposta tutto quello che viene dopo. */
export function applica(editor: Editor, proposte: Proposta[]) {
  const perBlocco = new Map<string, Proposta[]>()
  for (const p of proposte) perBlocco.set(p.dopo, [...(perBlocco.get(p.dopo) ?? []), p])

  let fatte = 0
  for (const [dopo, gruppo] of perBlocco) {
    const bersaglio = trova(editor, dopo)
    if (!bersaglio) continue

    const { pos, nodo } = bersaglio
    const elenco = nodo.type.name === 'bulletList' || nodo.type.name === 'orderedList'

    const blocchi = gruppo.map((p) => {
      let testo = p.testo.trim()
      // in un elenco il trattino lo mette già l'elenco
      if (elenco) testo = testo.replace(/^[-–•*]\s+/, '')
      // grassetto, colori ed evidenziatore come negli appunti (vedi marcatura.ts)
      const segnato = daMarcatura(
        (p.tipo === 'correggi' ? '⚠︎ ' : '') + testo,
        [{ type: 'segnoAi', attrs: { fonte: 'audio', stato: 'proposto' } }],
      )
      return elenco
        ? { type: 'listItem', content: [{ type: 'paragraph', content: segnato }] }
        : { type: 'paragraph', content: segnato }
    })

    // in fondo all'elenco (dentro, prima della chiusura) o dopo il blocco
    const dove = elenco ? pos + nodo.nodeSize - 1 : pos + nodo.nodeSize
    if (editor.chain().insertContentAt(dove, blocchi).run()) fatte += gruppo.length
  }
  return fatte
}

export type Titolo = { prima: string; titolo: string }

/*  I titoli degli argomenti che mancano: un titolo 1 proposto, messo
 *  PRIMA del blocco dove il nuovo argomento comincia. Si rivede come le
 *  altre proposte. Mai due titoli di fila, mai davanti a un titolo. */
export function applicaTitoli(editor: Editor, titoli: Titolo[]) {
  let fatti = 0
  for (const t of titoli.slice(0, 3)) {
    const bersaglio = trova(editor, t.prima)
    const testo = t.titolo.trim().replace(/^#+\s*/, '').replace(/\*\*/g, '')
    if (!bersaglio || !testo || bersaglio.nodo.type.name === 'heading') continue
    const prima = editor.state.doc.resolve(bersaglio.pos).nodeBefore
    if (prima?.type.name === 'heading') continue
    const ok = editor.chain().insertContentAt(bersaglio.pos, {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: testo, marks: [{ type: 'segnoAi', attrs: { fonte: 'audio', stato: 'proposto' } }] }],
    }).run()
    if (ok) fatti++
  }
  return fatti
}

/** Il testo di ogni riga della pagina — paragrafi, titoli, singole
 *  voci d'elenco — per capire se una proposta dice cose già scritte. */
export function righeDi(editor: Editor): string[] {
  const righe: string[] = []
  editor.state.doc.descendants((n) => {
    if (n.isTextblock) {
      if (n.textContent.trim()) righe.push(n.textContent)
      return false
    }
    return true
  })
  return righe
}

/*  Le àncore puntano al blocco dove stava il cursore. Spesso è una
 *  riga VUOTA — quella su cui stavi per scrivere — che il prompt non
 *  elenca, perché non contiene niente: il modello vedeva un id che non
 *  esiste negli appunti, lo usava come «dopo», e la proposta veniva
 *  scartata. Le righe vuote si leggono come la riga piena di sopra;
 *  i blocchi cancellati dopo la lezione non si sa dove fossero. */
export function rimappaBlocchi(editor: Editor): (id: string) => string | null {
  const verso = new Map<string, string | null>()
  let ultimoPieno: string | null = null
  editor.state.doc.forEach((n) => {
    const id = n.attrs.idBlocco as string | undefined
    const pieno = n.type.name === 'immagine' || n.textContent.trim() !== ''
    if (pieno && id) ultimoPieno = id
    if (id) verso.set(id, pieno ? id : ultimoPieno)
  })
  return (id) => verso.get(id) ?? null
}

/** Blocchi di primo livello, come li vede il prompt. */
export function blocchiDi(editor: Editor) {
  const tipo = (n: NodoPM) =>
    n.type.name === 'heading' ? `titolo ${n.attrs.level}` :
    n.type.name === 'bulletList' ? 'elenco' :
    n.type.name === 'orderedList' ? 'elenco numerato' :
    n.type.name === 'blockquote' ? 'citazione' :
    n.type.name === 'codeBlock' ? 'codice' :
    n.type.name === 'immagine' ? 'immagine' : 'paragrafo'

  const blocchi: { id: string; tipo: string; testo: string }[] = []
  editor.state.doc.forEach((n) => {
    const id = n.attrs.idBlocco as string | undefined
    if (!id) return
    const testo = n.type.name === 'immagine'
      ? String(n.attrs.didascalia || 'immagine')
      : n.type.name === 'blockMath'
        ? `$$${String(n.attrs.latex ?? '')}$$`
        : inMarcatura(n)
    if (testo) blocchi.push({ id, tipo: tipo(n), testo })
  })
  return blocchi
}
