import type { Node as NodoPM } from '@tiptap/pm/model'
import { COLORI, type Colore } from '../stili/colori'

/*  La formattazione degli appunti, in un testo che il modello sa leggere
 *  e scrivere.
 *
 *  Il modello vedeva gli appunti come testo nudo: non poteva sapere che
 *  i titoletti li scrivi in grassetto e le parole importanti in rosso,
 *  e le sue proposte arrivavano tutte piatte. Ora gli appunti gli
 *  arrivano così:
 *
 *      **grassetto**    <rosso>colorato</rosso>    ==evidenziato==
 *      $E = mc^2$       (una formula, in LaTeX)
 *
 *  e le proposte che tornano indietro, scritte allo stesso modo,
 *  diventano grassetto, colore, evidenziatore e formule vere. */

type Segno = { type: string; attrs?: Record<string, unknown> }
export type PezzoDiTesto = { type: 'text'; text: string; marks: Segno[] }
/** una formula dentro a una proposta: `$P_{95}=\mu+1{,}645\sigma$` */
export type PezzoFormula = { type: 'inlineMath'; attrs: { latex: string }; marks: Segno[] }
export type Pezzo = PezzoDiTesto | PezzoFormula

const eColore = (x: string): x is Colore => (COLORI as readonly string[]).includes(x)

/** Il testo di un blocco con la sua formattazione, per il prompt. */
export function inMarcatura(blocco: NodoPM): string {
  const righe: string[] = []
  let riga = ''
  blocco.descendants((n) => {
    if (n.isBlock && riga) { righe.push(riga); riga = '' }
    if (n.type.name === 'inlineMath') riga += `$${String(n.attrs.latex ?? '')}$`
    if (!n.isText) return true
    let t = n.text ?? ''
    const colore = n.marks.find((m) => m.type.name === 'coloreTesto')?.attrs.nome as string | undefined
    if (n.marks.some((m) => m.type.name === 'highlight')) t = `==${t}==`
    if (colore && eColore(colore)) t = `<${colore}>${t}</${colore}>`
    if (n.marks.some((m) => m.type.name === 'bold')) t = `**${t}**`
    riga += t
    return false
  })
  if (riga) righe.push(riga)
  return righe.join(' · ').replace(/\s+/g, ' ').trim()
}

/** Il contrario: il testo di una proposta, coi segni che diventano
 *  formattazione vera. Un segno lasciato aperto vale fino alla fine;
 *  quelli che non si capiscono restano testo. `sempre` sono i segni da
 *  mettere su tutto (quello che dice «proposta dall'AI»). I colori si
 *  fermano a due per proposta: il modello tende a colorare ogni numero,
 *  e una riga tutta rossa non evidenzia più niente. */
const MASSIMO_COLORI = 2

export function daMarcatura(testo: string, sempre: Segno[]): Pezzo[] {
  const pezzi: Pezzo[] = []
  let grassetto = false
  let evidenziato = false
  const colori: Colore[] = []
  let aperti = 0
  let ignorati = 0

  const marche = () => {
    const marks: Segno[] = [...sempre]
    if (grassetto) marks.push({ type: 'bold' })
    if (evidenziato) marks.push({ type: 'highlight' })
    const colore = colori[colori.length - 1]
    if (colore) marks.push({ type: 'coloreTesto', attrs: { nome: colore } })
    return marks
  }

  const aggiungi = (t: string) => {
    if (t) pezzi.push({ type: 'text', text: t, marks: marche() })
  }

  /*  Le formule si riconoscono per prime: dentro al LaTeX ci sono
   *  graffe e underscore, non i segni di qui, e un `$…$` mangiato a
   *  metà diventerebbe testo coi dollari in mezzo.
   *
   *  Dopo il dollaro ci vuole subito un carattere non bianco, e la
   *  formula sta in 200 caratteri: senza, «costa 5$ e poi 10$»
   *  diventava la formula « e poi 10». */
  const segni = /\$\$?(?<latex>[^\s$][^$]{0,199}?)\$\$?|\*\*|==|<(?<chiusura>\/?)(?<colore>rosso|arancio|verde|blu|viola)>/g
  let ultimo = 0
  for (const m of testo.matchAll(segni)) {
    aggiungi(testo.slice(ultimo, m.index))
    ultimo = m.index + m[0].length
    const { latex, chiusura, colore } = m.groups ?? {}
    if (latex) pezzi.push({ type: 'inlineMath', attrs: { latex: latex.trim() }, marks: marche() })
    else if (m[0] === '**') grassetto = !grassetto
    else if (m[0] === '==') evidenziato = !evidenziato
    else if (chiusura) {
      if (ignorati) { ignorati--; continue }
      const i = colori.lastIndexOf(colore as Colore)
      if (i >= 0) colori.splice(i, 1)
    }
    else if (++aperti > MASSIMO_COLORI) ignorati++
    else colori.push(colore as Colore)
  }
  aggiungi(testo.slice(ultimo))
  return pezzi
}

/** Il testo senza i segni: per confrontare le proposte fra loro. */
export const senzaMarcatura = (t: string) => t.replace(/\*\*|==|<\/?(rosso|arancio|verde|blu|viola)>/g, '')

/*  Lo stile della pagina, detto al modello in chiaro. Chiedergli di
 *  «imitare la formattazione» non bastava: vedeva i tuoi <rosso>20
 *  punti</rosso> e scriveva lo stesso tutto piatto. Con un'istruzione
 *  concreta e un esempio preso dai tuoi appunti, lo fa. */
export type Stile = {
  colore: Colore | null
  esempioColore: string | null      // una riga dove usi il colore
  titolettiInGrassetto: boolean      // righe brevi tutte in grassetto
  paroleInGrassetto: boolean         // grassetto dentro una frase
  evidenziatore: boolean
  /*  La FORMA delle righe. La formattazione non basta: una proposta
   *  può avere il grassetto giusto e restare riconoscibile lontano un
   *  miglio, perché è un periodo di tre righe con la maiuscola e il
   *  punto finale in mezzo a frammenti in minuscolo. */
  minuscolo: boolean                 // comincia le righe in minuscolo
  senzaPunto: boolean                // non le chiude col punto
  lunghezza: number                  // caratteri per riga, la mediana
  simboli: string[]                  // i simboli che usa davvero (→, ·, =)
  esempi: string[]                   // due righe sue, da imitare
}

export function stileDellaPagina(doc: NodoPM): Stile {
  let titoletti = false
  let parole = false
  let evidenziatore = false
  let esempioColore: string | null = null
  const colore = coloreDellaPagina(doc)
  const righe: { piano: string; marcato: string }[] = []

  doc.descendants((n) => {
    if (!n.isTextblock) return true
    const testi: { t: string; grassetto: boolean }[] = []
    let daAi = false
    n.forEach((t) => {
      if (!t.isText) return
      testi.push({ t: t.text ?? '', grassetto: t.marks.some((m) => m.type.name === 'bold') })
      if (t.marks.some((m) => m.type.name === 'segnoAi')) daAi = true
      if (t.marks.some((m) => m.type.name === 'highlight')) evidenziatore = true
      if (colore && !esempioColore && t.marks.some((m) => m.type.name === 'coloreTesto' && m.attrs.nome === colore)) {
        esempioColore = inMarcatura(n).slice(0, 120)
      }
    })
    const tutto = testi.map((x) => x.t).join('').trim()
    if (tutto && testi.every((x) => x.grassetto || !x.t.trim()) && tutto.length < 60) titoletti = true
    else if (testi.some((x) => x.grassetto && x.t.trim())) parole = true
    // la forma si misura solo su ciò che ha scritto LUI: le proposte
    // dell'AI, se restano in pagina, gli farebbero imitare sé stesso
    if (tutto && !daAi && n.type.name === 'paragraph') righe.push({ piano: tutto, marcato: inMarcatura(n) })
    return false
  })

  return {
    colore, esempioColore, titolettiInGrassetto: titoletti, paroleInGrassetto: parole, evidenziatore,
    ...formaDelleRighe(righe),
  }
}

/*  I simboli da cercare: quelli che uno scrive a mano al posto delle
 *  parole. Non la punteggiatura, che c'è in qualunque testo. */
const SIMBOLI = ['→', '⇒', '↔', '≈', '≠', '≥', '≤', '·', '–', '—', '=', '+', '%', '/']

const mediana = (n: number[]) => (n.length ? [...n].sort((a, b) => a - b)[Math.floor(n.length / 2)] : 0)

/** Com'è fatta una riga sua: lunghezza, maiuscole, punto, simboli. */
function formaDelleRighe(righe: { piano: string; marcato: string }[]) {
  const vere = righe.filter((r) => r.piano.length > 2)
  const lunghezza = mediana(vere.map((r) => r.piano.length))
  const conLettera = vere.filter((r) => /^\p{L}/u.test(r.piano))
  const minuscole = conLettera.filter((r) => r.piano[0] === r.piano[0].toLowerCase()).length
  const conPunto = vere.filter((r) => /[.!?]$/.test(r.piano)).length
  // un simbolo vale solo se torna: una freccia sola può essere un caso
  const simboli = SIMBOLI.filter((s) => vere.filter((r) => r.piano.includes(s)).length >= 2).slice(0, 4)

  /*  Gli esempi: le righe di lunghezza mediana, cioè le più sue. La
   *  più lunga e la più corta di una pagina sono due eccezioni, e
   *  imitare un'eccezione è peggio che non imitare niente. */
  const esempi = vere
    .filter((r) => r.piano.length >= 12)
    .sort((a, b) => Math.abs(a.piano.length - lunghezza) - Math.abs(b.piano.length - lunghezza))
    .slice(0, 2)
    .map((r) => (r.marcato.length > 140 ? `${r.marcato.slice(0, 137)}…` : r.marcato))

  return {
    minuscolo: conLettera.length >= 3 && minuscole / conLettera.length >= 0.6,
    senzaPunto: vere.length >= 3 && conPunto / vere.length <= 0.25,
    lunghezza: vere.length >= 3 ? lunghezza : 0,
    simboli,
    esempi,
  }
}

/** Le istruzioni sulla formattazione, per il messaggio al modello. */
export function istruzioniDiStile(s: Stile): string {
  const righe: string[] = []
  if (s.colore) {
    righe.push(`- Colora di <${s.colore}> le 1-2 parole o i dati più importanti di ogni proposta, come fa lui` +
      (s.esempioColore ? ` (per esempio: «${s.esempioColore}»).` : '.'))
  } else {
    righe.push('- Non usare colori: in questa pagina lo studente non ne usa.')
  }
  if (s.titolettiInGrassetto) righe.push('- Scrive i titoletti in **grassetto**: se proponi un titoletto, scrivilo così.')
  if (s.paroleInGrassetto) righe.push('- Mette in **grassetto** i termini chiave dentro le frasi: fallo anche tu, con misura.')
  if (s.evidenziatore) righe.push('- Usa l\'==evidenziatore== per ciò che conta di più: puoi usarlo anche tu, raramente.')
  if (s.lunghezza) {
    const quanto = s.lunghezza < 45 ? 'brevissime' : s.lunghezza < 90 ? 'brevi' : 'distese'
    righe.push(`- Le sue righe sono ${quanto}: circa ${s.lunghezza} caratteri. Non scriverne di più lunghe.`)
  }
  if (s.minuscolo) righe.push('- Comincia le righe in minuscolo: comincia in minuscolo anche tu.')
  if (s.senzaPunto) righe.push('- Non chiude le righe col punto: non metterlo neanche tu.')
  if (s.simboli.length) righe.push(`- Usa questi simboli al posto delle parole: ${s.simboli.join(' ')} — usali dove li userebbe lui.`)
  if (s.esempi.length) {
    righe.push(`- Due righe scritte da lui. Le tue devono sembrare della stessa mano:\n${s.esempi.map((e) => `    «${e}»`).join('\n')}`)
  }
  return righe.join('\n')
}

/** Quale colore usi di più in questa pagina, se ne usi uno. */
export function coloreDellaPagina(doc: NodoPM): Colore | null {
  const conte = new Map<Colore, number>()
  doc.descendants((n) => {
    if (!n.isText) return true
    const nome = n.marks.find((m) => m.type.name === 'coloreTesto')?.attrs.nome as string | undefined
    if (nome && eColore(nome)) conte.set(nome, (conte.get(nome) ?? 0) + (n.text?.length ?? 0))
    return false
  })
  return [...conte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
