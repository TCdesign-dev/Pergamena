import type { Editor } from '@tiptap/core'
import type { Node as NodoPM } from '@tiptap/pm/model'
import { daMarcatura, inMarcatura } from './marcatura'
import { normalizza } from '../lib/testo'

export type Proposta = {
  dopo: string
  /*  «integra» apre una riga nuova dopo il blocco; «completa» entra
   *  DENTRO la riga che c'è già, in fondo o nel punto indicato;
   *  «correggi» è una riga nuova che segnala un dato sbagliato. */
  tipo: 'integra' | 'completa' | 'correggi'
  /** solo per «completa»: le parole della sua riga dopo cui va infilato */
  punto?: string
  /*  solo per «integra»: il nome dell'argomento che questa riga apre,
      quando negli appunti di quell'argomento non c'è traccia. Diventa
      un «titolo 1» davanti alla riga. */
  titolo?: string
  testo: string
  perche: string
  importanza: number
}

const SEGNO_AI = [{ type: 'segnoAi', attrs: { fonte: 'audio', stato: 'proposto' } }]

/** Un titolo con queste parole c'è già? Fra un'integrazione e l'altra
 *  della stessa pagina capita che lo stesso argomento venga aperto due
 *  volte. */
function titoloGiaPresente(editor: Editor, testo: string) {
  const cercato = normalizza(testo).trim()
  let presente = false
  editor.state.doc.forEach((n) => {
    if (n.type.name === 'heading' && normalizza(n.textContent).trim() === cercato) presente = true
  })
  return presente
}

/** Il nome dell'argomento ripulito, se la proposta ne porta uno. */
function nomeArgomento(p: Proposta) {
  const t = p.titolo?.trim().replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
  return t || null
}

/*  Dove sta, adesso, il blocco con quell'id — anche dentro un elenco.
 *
 *  Prima si guardava solo il primo livello, e un elenco era un blocco
 *  solo: cinque voci con la freccia in fondo diventavano una riga
 *  sola, e il modello poteva completarne una. Le voci un id ce l'hanno
 *  (vedi idStabile), bastava cercarlo. */
function trova(editor: Editor, id: string): { pos: number; nodo: NodoPM } | null {
  let trovato: { pos: number; nodo: NodoPM } | null = null
  editor.state.doc.descendants((nodo, pos) => {
    if (trovato) return false
    if (nodo.attrs.idBlocco === id) { trovato = { pos, nodo }; return false }
    return true
  })
  return trovato
}

/*  ── I completamenti ─────────────────────────────────────────────
 *
 *  Una proposta che finisce la TUA riga invece di scriverne una nuova
 *  accanto. Il modello manda solo il pezzo che manca e le parole dopo
 *  cui va infilato: qui si ritrovano quelle parole nel documento.
 *
 *  Il confronto passa da `normalizza`, che toglie accenti e maiuscole
 *  senza cambiare la lunghezza: ogni carattere del testo semplificato
 *  corrisponde a un carattere vero, e quindi a una posizione. */
type Carattere = { c: string; fine: number }

function caratteri(nodo: NodoPM, pos: number): Carattere[] {
  const out: Carattere[] = []
  nodo.descendants((n, off) => {
    if (!n.isText) return true
    const t = n.text ?? ''
    for (let i = 0; i < t.length; i++) out.push({ c: t[i], fine: pos + 1 + off + i + 1 })
    return false
  })
  return out
}

const fuggi = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/*  Dove infilare il pezzo: dopo le parole di `punto`, o in fondo alla
 *  riga se non le trova (o se non ne ha indicate).
 *
 *  L'àncora il modello la cita a memoria, quindi non combacia mai del
 *  tutto: le parole si cercano separate da spazi qualunque, e se non
 *  si trovano tutte si riprova senza la prima, perché la coda è la
 *  parte che sbaglia di meno. Mai sotto le due parole: «di» da solo
 *  si troverebbe ovunque. */
function innesto(nodo: NodoPM, pos: number, punto?: string) {
  const cs = caratteri(nodo, pos)
  if (!cs.length) return null

  const ultimo = cs[cs.length - 1]
  const inFondo = () => ({ dove: ultimo.fine, prima: ultimo.c, dopo: '' })

  const parole = normalizza((punto ?? '').trim()).split(/\s+/).filter(Boolean)
  if (!parole.length) return inFondo()

  const testo = normalizza(cs.map((c) => c.c).join(''))
  const minime = Math.min(2, parole.length)
  for (let da = 0; da <= parole.length - minime; da++) {
    const re = new RegExp(parole.slice(da).map(fuggi).join('[\\s·]+'), 'g')
    const trovati = [...testo.matchAll(re)]
    const m = trovati[trovati.length - 1]
    if (!m) continue
    const i = m.index + m[0].length
    /*  Se dopo l'àncora resta quasi niente — «misura del corpo» in
     *  «misura del corpo umano» — il modello voleva la fine della riga
     *  e ha smesso di copiare una parola troppo presto. Infilarsi lì
     *  spezzerebbe la frase: meglio scivolare in fondo. */
    const resto = testo.slice(i).trim()
    if (resto.length < 15 && resto.split(/\s+/).filter(Boolean).length <= 2) return inFondo()
    return { dove: cs[i - 1].fine, prima: cs[i - 1].c, dopo: cs[i]?.c ?? '' }
  }
  return inFondo()
}

function completa(editor: Editor, p: Proposta): boolean {
  const bersaglio = trova(editor, p.dopo)
  if (!bersaglio) return false
  const dove = innesto(bersaglio.nodo, bersaglio.pos, p.punto)
  if (!dove) return false

  let testo = p.testo.trim().replace(/^[-–•*]\s+/, '')
  if (!testo) return false
  // gli spazi intorno li mette il programma: il modello manda il pezzo
  if (dove.prima && !/\s/.test(dove.prima) && !/^[,.;:!?)»…]/.test(testo)) testo = ` ${testo}`
  if (dove.dopo && !/[\s,.;:!?)»…]/.test(dove.dopo)) testo = `${testo} `

  return editor.chain().insertContentAt(dove.dove, daMarcatura(testo, SEGNO_AI)).run()
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
  let fatte = 0

  /*  Prima i completamenti, che entrano dentro alle righe: le righe
   *  nuove si agganciano al blocco cercandolo per id, quindi non
   *  importa quanto testo è cresciuto prima di loro. */
  for (const p of proposte) if (p.tipo === 'completa' && completa(editor, p)) fatte++

  const perBlocco = new Map<string, Proposta[]>()
  for (const p of proposte) {
    if (p.tipo === 'completa') continue
    perBlocco.set(p.dopo, [...(perBlocco.get(p.dopo) ?? []), p])
  }

  //  i titoli messi in questo giro: due proposte che aprono lo stesso
  //  argomento non devono produrre due titoli uguali di fila
  const messi = new Set<string>()

  for (const [dopo, gruppo] of perBlocco) {
    const bersaglio = trova(editor, dopo)
    if (!bersaglio) continue

    const { pos, nodo } = bersaglio
    const elenco = nodo.type.name === 'bulletList' || nodo.type.name === 'orderedList'
    //  adesso una proposta può agganciarsi alla singola voce: la riga
    //  nuova le va accanto, sorella, non in fondo all'elenco
    const voce = nodo.type.name === 'listItem'
    const inElenco = elenco || voce

    const blocchi = gruppo.flatMap((p) => {
      let testo = p.testo.trim()
      // in un elenco il trattino lo mette già l'elenco
      if (inElenco) testo = testo.replace(/^[-–•*]\s+/, '')
      // grassetto, colori ed evidenziatore come negli appunti (vedi marcatura.ts)
      const segnato = daMarcatura((p.tipo === 'correggi' ? '⚠︎ ' : '') + testo, SEGNO_AI)
      const riga = inElenco
        ? { type: 'listItem', content: [{ type: 'paragraph', content: segnato }] }
        : { type: 'paragraph', content: segnato }

      /*  L'argomento di cui negli appunti non c'era niente arriva con il
       *  suo titolo davanti. Dentro un elenco no: un titolo in mezzo
       *  alle voci non è un titolo, è una voce storta. E non dietro a un
       *  titolo, che sarebbe un titolo del titolo. */
      const titolo = p.tipo === 'integra' && !inElenco ? nomeArgomento(p) : null
      if (!titolo || nodo.type.name === 'heading') return [riga]
      const chiave = normalizza(titolo).trim()
      if (messi.has(chiave) || titoloGiaPresente(editor, titolo)) return [riga]
      messi.add(chiave)
      return [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: titolo, marks: SEGNO_AI }] },
        riga,
      ]
    })

    /*  In fondo all'elenco (dentro, prima della chiusura) quando la
     *  proposta punta all'elenco intero; subito dopo la voce quando
     *  punta a una voce; dopo il blocco in tutti gli altri casi. */
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
    if (titoloGiaPresente(editor, testo)) continue
    const ok = editor.chain().insertContentAt(bersaglio.pos, {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: testo, marks: SEGNO_AI }],
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

  /*  Anche dentro gli elenchi, e nello stesso ordine in cui il prompt
   *  li elenca: un'àncora che punta a una voce deve trovarla. Un
   *  elenco intero punta alla sua ultima voce — le àncore vecchie
   *  segnavano il contenitore, e senza questo diventavano «nessun
   *  blocco»: la lezione risultava scritta da nessuna parte, e il
   *  riempitore ci vedeva un buco dove invece stavi scrivendo. */
  const scorri = (padre: NodoPM) => {
    padre.forEach((n) => {
      const id = n.attrs.idBlocco as string | undefined
      if (ELENCO(n)) {
        const prima = ultimoPieno
        scorri(n)
        if (id) verso.set(id, ultimoPieno !== prima ? ultimoPieno : prima)
        return
      }
      const pieno = n.type.name === 'immagine' || n.textContent.trim() !== ''
      if (pieno && id) ultimoPieno = id
      if (id) verso.set(id, pieno ? id : ultimoPieno)
      if (n.type.name === 'listItem') n.forEach((figlio) => { if (ELENCO(figlio)) scorri(figlio) })
    })
  }
  scorri(editor.state.doc)

  return (id) => verso.get(id) ?? null
}

const ELENCO = (n: NodoPM) => n.type.name === 'bulletList' || n.type.name === 'orderedList'

/*  I blocchi come li vede il prompt, UNA VOCE D'ELENCO PER RIGA.
 *
 *  Prima si fermava al primo livello, e un elenco arrivava al modello
 *  come una riga sola: «**Problema** → · **Idea guida** → · **Tono** →».
 *  Un id solo, una riga sola, quindi un completamento solo — e infatti
 *  di cinque voci da completare ne completava l'ultima, con dentro il
 *  materiale di tutte e cinque. Le voci un id ce l'hanno già: basta
 *  elencarle. Il `rientro` dice quanto sono annidate, così il prompt le
 *  può disegnare dove stanno. */
export function blocchiDi(editor: Editor) {
  const tipo = (n: NodoPM) =>
    n.type.name === 'heading' ? `titolo ${n.attrs.level}` :
    n.type.name === 'listItem' ? 'voce' :
    n.type.name === 'blockquote' ? 'citazione' :
    n.type.name === 'codeBlock' ? 'codice' :
    n.type.name === 'immagine' ? 'immagine' : 'paragrafo'

  const blocchi: { id: string; tipo: string; testo: string; rientro: number }[] = []

  const scorri = (padre: NodoPM, rientro: number) => {
    padre.forEach((n) => {
      //  l'elenco in sé non è una riga: lo sono le sue voci
      if (ELENCO(n)) { scorri(n, rientro); return }

      const id = n.attrs.idBlocco as string | undefined
      if (n.type.name === 'listItem') {
        //  il testo della voce è il suo paragrafo, non i sottoelenchi
        const suo = n.firstChild ? inMarcatura(n.firstChild) : ''
        if (id && suo) blocchi.push({ id, tipo: 'voce', testo: suo, rientro })
        n.forEach((figlio) => { if (ELENCO(figlio)) scorri(figlio, rientro + 1) })
        return
      }

      if (!id) return
      const testo = n.type.name === 'immagine'
        ? String(n.attrs.didascalia || 'immagine')
        : n.type.name === 'blockMath'
          ? `$$${String(n.attrs.latex ?? '')}$$`
          : inMarcatura(n)
      if (testo) blocchi.push({ id, tipo: tipo(n), testo, rientro })
    })
  }

  scorri(editor.state.doc, 0)
  return blocchi
}
