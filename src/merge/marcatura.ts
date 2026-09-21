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
 *
 *  e le proposte che tornano indietro, scritte allo stesso modo,
 *  diventano grassetto, colore ed evidenziatore veri. */

type Segno = { type: string; attrs?: Record<string, unknown> }
export type PezzoDiTesto = { type: 'text'; text: string; marks: Segno[] }

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

export function daMarcatura(testo: string, sempre: Segno[]): PezzoDiTesto[] {
  const pezzi: PezzoDiTesto[] = []
  let grassetto = false
  let evidenziato = false
  const colori: Colore[] = []
  let aperti = 0
  let ignorati = 0

  const aggiungi = (t: string) => {
    if (!t) return
    const marks: Segno[] = [...sempre]
    if (grassetto) marks.push({ type: 'bold' })
    if (evidenziato) marks.push({ type: 'highlight' })
    const colore = colori[colori.length - 1]
    if (colore) marks.push({ type: 'coloreTesto', attrs: { nome: colore } })
    pezzi.push({ type: 'text', text: t, marks })
  }

  const segni = /\*\*|==|<(\/?)(rosso|arancio|verde|blu|viola)>/g
  let ultimo = 0
  for (const m of testo.matchAll(segni)) {
    aggiungi(testo.slice(ultimo, m.index))
    ultimo = m.index! + m[0].length
    if (m[0] === '**') grassetto = !grassetto
    else if (m[0] === '==') evidenziato = !evidenziato
    else if (m[1]) {
      if (ignorati) { ignorati--; continue }
      const i = colori.lastIndexOf(m[2] as Colore)
      if (i >= 0) colori.splice(i, 1)
    }
    else if (++aperti > MASSIMO_COLORI) ignorati++
    else colori.push(m[2] as Colore)
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
}

export function stileDellaPagina(doc: NodoPM): Stile {
  let titoletti = false
  let parole = false
  let evidenziatore = false
  let esempioColore: string | null = null
  const colore = coloreDellaPagina(doc)
  doc.descendants((n) => {
    if (!n.isTextblock) return true
    const testi: { t: string; grassetto: boolean }[] = []
    n.forEach((t) => {
      if (!t.isText) return
      testi.push({ t: t.text ?? '', grassetto: t.marks.some((m) => m.type.name === 'bold') })
      if (t.marks.some((m) => m.type.name === 'highlight')) evidenziatore = true
      if (colore && !esempioColore && t.marks.some((m) => m.type.name === 'coloreTesto' && m.attrs.nome === colore)) {
        esempioColore = inMarcatura(n).slice(0, 120)
      }
    })
    const tutto = testi.map((x) => x.t).join('').trim()
    if (tutto && testi.every((x) => x.grassetto || !x.t.trim()) && tutto.length < 60) titoletti = true
    else if (testi.some((x) => x.grassetto && x.t.trim())) parole = true
    return false
  })
  return { colore, esempioColore, titolettiInGrassetto: titoletti, paroleInGrassetto: parole, evidenziatore }
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
