import katex from 'katex'
import { Fragment, type ReactNode } from 'react'
import s from './Marcato.module.css'

/*  Il testo che scrive il modello quando NON finisce dentro gli
 *  appunti: le risposte alle domande, le spiegazioni dei quiz, il punto
 *  della situazione. Negli appunti ci pensa ProseMirror a dare un corpo
 *  ai segni; qui no, e senza qualcuno che li legga restano lì come
 *  sono: «**parola**» invece di parola in grassetto.
 *
 *  Si leggono gli stessi segni che il progetto usa già parlando con i
 *  modelli (vedi merge/marcatura.ts) — **grassetto**, ==evidenziato==,
 *  $formula$ — più il corsivo e il codice, che i modelli mettono da
 *  sé. Niente di più: i prompt chiedono di non usare altro, e quel che
 *  passa lo stesso (un titolo con i cancelletti) viene ripulito invece
 *  di finire a schermo con i suoi simboli. */

const SEGNI = new RegExp(
  [
    String.raw`\$\$?(?<latex>[^\s$][^$]{0,199}?)\$\$?`,
    String.raw`\*\*(?<forte>[^*]+)\*\*`,
    String.raw`==(?<evidenziato>[^=]+)==`,
    '`(?<codice>[^`]+)`',
    String.raw`\*(?<corsivo>[^*\n]+)\*`,
  ].join('|'),
  'g',
)

const VOCE = /^\s*(?:[-–•*]\s+|(\d+)[.)]\s+)/
const TITOLO = /^\s*#{1,6}\s+/

function formula(latex: string, chiave: number) {
  //  una formula sbagliata non deve far sparire la risposta: KaTeX
  //  la rende in rosso e si va avanti
  const html = katex.renderToString(latex, { throwOnError: false, strict: false })
  return <span key={chiave} className={s.formula} dangerouslySetInnerHTML={{ __html: html }} />
}

/** I segni dentro una riga. */
function inRiga(testo: string): ReactNode[] {
  const fuori: ReactNode[] = []
  let ultimo = 0
  for (let m; (m = SEGNI.exec(testo)) !== null; ) {
    if (m.index > ultimo) fuori.push(testo.slice(ultimo, m.index))
    const g = m.groups!
    const k = fuori.length
    if (g.latex !== undefined) fuori.push(formula(g.latex, k))
    else if (g.forte !== undefined) fuori.push(<b key={k}>{g.forte}</b>)
    else if (g.evidenziato !== undefined) fuori.push(<mark key={k} className={s.evidenziato}>{g.evidenziato}</mark>)
    else if (g.codice !== undefined) fuori.push(<code key={k} className={s.codice}>{g.codice}</code>)
    else fuori.push(<i key={k}>{g.corsivo}</i>)
    ultimo = m.index + m[0].length
  }
  if (ultimo < testo.length) fuori.push(testo.slice(ultimo))
  return fuori
}

export function Marcato({ testo, blocchi = true }: {
  testo: string
  /** false quando il testo sta già dentro un <li> o un <p> suo */
  blocchi?: boolean
}) {
  if (!blocchi) return <>{inRiga(testo)}</>

  const righe = testo.split('\n')
  const fuori: ReactNode[] = []
  let elenco: { numerato: boolean; voci: string[] } | null = null

  const chiudiElenco = () => {
    if (!elenco) return
    const voci = elenco.voci.map((v, i) => <li key={i}>{inRiga(v)}</li>)
    fuori.push(elenco.numerato
      ? <ol key={fuori.length} className={s.elenco}>{voci}</ol>
      : <ul key={fuori.length} className={s.elenco}>{voci}</ul>)
    elenco = null
  }

  for (const riga of righe) {
    const voce = VOCE.exec(riga)
    if (voce) {
      const numerato = voce[1] !== undefined
      if (elenco && elenco.numerato !== numerato) chiudiElenco()
      elenco ??= { numerato, voci: [] }
      elenco.voci.push(riga.slice(voce[0].length))
      continue
    }
    chiudiElenco()
    if (!riga.trim()) continue
    const titolo = TITOLO.test(riga)
    fuori.push(
      <p key={fuori.length} className={s.riga}>
        {titolo ? <b>{inRiga(riga.replace(TITOLO, ''))}</b> : inRiga(riga)}
      </p>,
    )
  }
  chiudiElenco()
  return <>{fuori.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>
}
